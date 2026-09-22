<?php

namespace App\Http\Controllers\Store;

use App\Http\Controllers\Controller;
use Illuminate\Database\Connection;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\Process\Process;

class StoreController extends Controller
{
    private function apiPath(): string
    {
        $configuredPath = env('POD_API_PATH');
        $path = $configuredPath ?: base_path('../api');

        return realpath($path) ?: $path;
    }

    private function mockupApiUrl(): string
    {
        return rtrim(
            (string) config('services.pod_mockup.url', 'http://127.0.0.1:8000'),
            '/',
        );
    }

    /** @param list<string> $catalogSlugs */
    private function catalogPreviewAreas(array $catalogSlugs): array
    {
        if ($catalogSlugs === []) {
            return [];
        }

        try {
            $response = Http::acceptJson()->timeout(8)->get(
                $this->mockupApiUrl().'/catalog-preview/print-areas',
                ['slugs' => implode(',', $catalogSlugs)],
            );
        } catch (ConnectionException) {
            return [];
        }

        $payload = $response->successful() ? $response->json('data') : null;
        if (! is_array($payload)) {
            return [];
        }

        return collect($payload)
            ->map(fn ($area) => $this->catalogPreviewArea($area))
            ->filter()
            ->all();
    }

    private function catalogPreviewArea(mixed $area): ?array
    {
        if (! is_array($area) || ($area['configured'] ?? false) !== true) {
            return null;
        }

        $primary = $this->catalogPrintAreaRect($area);
        $templateWidth = $area['template_width'] ?? null;
        $templateHeight = $area['template_height'] ?? null;
        if ($primary === null || ! is_numeric($templateWidth) || ! is_numeric($templateHeight)) {
            return null;
        }

        $width = (int) $templateWidth;
        $height = (int) $templateHeight;
        if ($width < 1 || $height < 1) {
            return null;
        }

        $regions = collect(is_array($area['regions'] ?? null) ? $area['regions'] : [])
            ->map(fn ($region) => $this->catalogPrintAreaRect($region))
            ->filter()
            ->values()
            ->all();
        $assets = collect(is_array($area['assets'] ?? null) ? $area['assets'] : [])
            ->map(function (mixed $asset): ?array {
                if (! is_array($asset) || ! is_numeric($asset['metadata_id'] ?? null)) {
                    return null;
                }
                $assetPrimary = $this->catalogPrintAreaRect($asset);
                $assetWidth = $asset['template_width'] ?? null;
                $assetHeight = $asset['template_height'] ?? null;
                $sourcePath = $asset['source_path'] ?? null;
                if ($assetPrimary === null || ! is_numeric($assetWidth) || ! is_numeric($assetHeight) || ! is_string($sourcePath) || $sourcePath === '') {
                    return null;
                }

                $assetRegions = collect(is_array($asset['regions'] ?? null) ? $asset['regions'] : [])
                    ->map(fn ($region) => $this->catalogPrintAreaRect($region))
                    ->filter()
                    ->values()
                    ->all();

                return [
                    'metadata_id' => (int) $asset['metadata_id'],
                    'asset_id' => isset($asset['asset_id']) && is_numeric($asset['asset_id']) ? (int) $asset['asset_id'] : null,
                    'placement' => (string) ($asset['placement'] ?? 'mockup'),
                    'source_path' => $sourcePath,
                    ...$assetPrimary,
                    'regions' => $assetRegions === [] ? [$assetPrimary] : $assetRegions,
                    'template_width' => (int) $assetWidth,
                    'template_height' => (int) $assetHeight,
                ];
            })
            ->filter()
            ->values()
            ->all();

        return [
            ...$primary,
            'regions' => $regions === [] ? [$primary] : $regions,
            'template_width' => $width,
            'template_height' => $height,
            'assets' => $assets,
        ];
    }

    private function catalogPrintAreaRect(mixed $area): ?array
    {
        if (! is_array($area)) {
            return null;
        }

        $keys = ['x', 'y', 'width', 'height'];
        if (collect($keys)->contains(fn (string $key): bool => ! is_numeric($area[$key] ?? null))) {
            return null;
        }

        $rect = [
            'x' => (float) $area['x'],
            'y' => (float) $area['y'],
            'width' => (float) $area['width'],
            'height' => (float) $area['height'],
        ];

        return $rect['x'] >= 0
            && $rect['y'] >= 0
            && $rect['width'] > 0
            && $rect['height'] > 0
            && $rect['x'] + $rect['width'] <= 1
            && $rect['y'] + $rect['height'] <= 1
            ? $rect
            : null;
    }

    private function resolvePublicAsset(?string $path, string $root): ?string
    {
        if (! is_string($path) || $path === '') {
            return null;
        }

        $candidate = str_starts_with($path, DIRECTORY_SEPARATOR)
            ? $path
            : $root.DIRECTORY_SEPARATOR.$path;
        $file = realpath($candidate);

        return $file !== false
            && is_file($file)
            && str_starts_with($file, $root.DIRECTORY_SEPARATOR)
            ? $file
            : null;
    }

    private function runImporter(array $arguments, int $timeout = 300): string
    {
        $apiPath = $this->apiPath();
        if (! is_file($apiPath.'/bootstrap-db.sh')) {
            throw ValidationException::withMessages(['import' => 'API path is invalid: bootstrap-db.sh was not found. Set POD_API_PATH in the Admin environment.']);
        }
        if (! is_file($apiPath.'/.venv/bin/python')) {
            throw ValidationException::withMessages(['import' => 'API virtualenv was not found at '.$apiPath.'/.venv/bin/python.']);
        }
        $environment = ['PATH' => '/Applications/ServBay/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:'.(getenv('PATH') ?: '')];
        $bootstrap = new Process(['/bin/bash', 'bootstrap-db.sh'], $apiPath, $environment);
        $bootstrap->setTimeout(300);
        $bootstrap->run();
        if (! $bootstrap->isSuccessful()) {
            throw ValidationException::withMessages(['import' => trim($bootstrap->getErrorOutput()) ?: 'Database migration failed.']);
        }

        $process = new Process([$apiPath.'/.venv/bin/python', '-m', 'app.cli', ...$arguments], $apiPath);
        $process->setTimeout($timeout);
        $process->run();
        if (! $process->isSuccessful()) {
            throw ValidationException::withMessages(['import' => trim($process->getErrorOutput()) ?: 'Import failed.']);
        }

        return trim($process->getOutput());
    }

    /** @return list<array{path: string, label: string, count: int}> */
    private function importFolders(): array
    {
        $root = $this->designRoot();
        if (! File::isDirectory($root)) {
            return [];
        }

        return collect(File::allFiles($root))
            ->filter(fn (\SplFileInfo $file) => in_array(strtolower($file->getExtension()), ['png', 'webp', 'jpg', 'jpeg'], true))
            ->groupBy(fn (\SplFileInfo $file) => $file->getPath())
            ->map(function ($files, string $directory) use ($root): array {
                $relative = ltrim(str_replace($root, '', $directory), DIRECTORY_SEPARATOR);
                $path = $relative === '' ? '.' : str_replace(DIRECTORY_SEPARATOR, '/', $relative);

                return [
                    'path' => $path,
                    'label' => $path === '.' ? 'design' : $path,
                    'count' => $files->count(),
                ];
            })
            ->sortBy('label')
            ->values()
            ->all();
    }

    private function designRoot(): string
    {
        return $this->apiPath().'/public/design';
    }

    private function modelMockupRoot(): string
    {
        return $this->apiPath().'/public/mockup';
    }

    private function modelMockupCategory(int $catalog): string
    {
        $departments = $this->table('catalog_taxonomy')
            ->where('catalog_id', $catalog)
            ->pluck('department')
            ->map(fn ($department): string => strtolower((string) $department));

        if ($departments->contains('men') && $departments->contains('women')) {
            return 'unisex';
        }

        return match (true) {
            $departments->contains('women') => 'women',
            $departments->contains('kids') => 'kids',
            $departments->contains('accessories') => 'accessories',
            $departments->contains('home-living') => 'home-living',
            default => 'other',
        };
    }

    public function importProducts(Request $request): RedirectResponse
    {
        $data = $request->validate(['folder' => 'required|string|max:500']);
        $root = realpath($this->designRoot());
        $directory = $root === false ? false : realpath($root.DIRECTORY_SEPARATOR.$data['folder']);
        if ($root === false || $directory === false || ! str_starts_with($directory.DIRECTORY_SEPARATOR, $root.DIRECTORY_SEPARATOR)) {
            throw ValidationException::withMessages(['folder' => 'Hãy chọn folder bên trong api/public/design.']);
        }
        if (! collect(File::allFiles($directory))->contains(fn (\SplFileInfo $file) => in_array(strtolower($file->getExtension()), ['png', 'webp', 'jpg', 'jpeg'], true))) {
            throw ValidationException::withMessages(['folder' => 'Folder đã chọn không có ảnh được hỗ trợ.']);
        }

        $relativeDirectory = $directory === $root
            ? ''
            : ltrim(str_replace($root, '', $directory), DIRECTORY_SEPARATOR);
        $designDirectory = 'public/design'.($relativeDirectory === '' ? '' : '/'.$relativeDirectory);
        $this->runImporter(['import-products', '--design-dir', $designDirectory, '--publish']);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Đã import products từ folder đã chọn.',
        ]);

        return back();
    }

    private function db(): Connection
    {
        return DB::connection('store');
    }

    private function table(string $table): Builder
    {
        return $this->db()->table($table);
    }

    private function find(string $table, int $id): object
    {
        return $this->table($table)->find($id) ?? abort(404);
    }

    /** @return array{q: string, status: string} */
    private function filters(Request $request): array
    {
        $data = $request->validate(['q' => 'nullable|string|max:190', 'status' => 'nullable|string|max:32']);

        return ['q' => $data['q'] ?? '', 'status' => $data['status'] ?? ''];
    }

    /** @param array<string, mixed> $before
     * @param  array<string, mixed>  $after
     */
    private function audit(Request $request, string $entity, int $id, array $before, array $after): void
    {
        $this->db()->table('activity_logs')->insert([
            'admin_user_id' => $request->user()?->getAuthIdentifier(),
            'entity_type' => $entity,
            'entity_id' => $id,
            'before_json' => json_encode($before, JSON_THROW_ON_ERROR),
            'after_json' => json_encode($after, JSON_THROW_ON_ERROR),
            'created_at' => now(),
        ]);
    }

    public function dashboard(): Response
    {
        return Inertia::render('dashboard', [
            'counts' => [
                'products' => $this->table('products')->count(),
                'activeProducts' => $this->table('products')->where('status', 'active')->count(),
                'catalogs' => $this->table('catalogs')->count(),
                'orders' => $this->table('orders')->count(),
                'pendingOrders' => $this->table('orders')->where('fulfillment_status', 'pending')->count(),
            ],
            'recentOrders' => $this->table('orders')->orderByDesc('id')->limit(8)->get(),
        ]);
    }

    public function operations(): Response
    {
        return Inertia::render('operations/index', [
            'importFolders' => $this->importFolders(),
            'operations' => array_map(fn (array $operation): array => [
                'id' => $operation['id'],
                'title' => $operation['title'],
                'description' => $operation['description'],
                'command' => $operation['command'],
                'confirmation' => $operation['confirmation'],
            ], array_values($this->operationDefinitions())),
        ]);
    }

    public function runOperation(string $operation): RedirectResponse
    {
        $definition = $this->operationDefinitions()[$operation] ?? null;
        abort_if($definition === null, 404);

        $this->runImporter($definition['arguments'], $definition['timeout']);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => $definition['success'],
        ]);

        return back();
    }

    /** @return array<string, array{id: string, title: string, description: string, command: string, arguments: list<string>, timeout: int, confirmation: string|null, success: string}> */
    private function operationDefinitions(): array
    {
        return [
            'analyze-catalog-mockups' => [
                'id' => 'analyze-catalog-mockups',
                'title' => 'Phân tích vùng in',
                'description' => 'Cập nhật vùng in an toàn cho ảnh catalog.',
                'command' => 'python -m app.cli analyze-catalog-mockups',
                'arguments' => ['analyze-catalog-mockups'],
                'timeout' => 300,
                'confirmation' => null,
                'success' => 'Đã cập nhật vùng in catalog.',
            ],
            'sync-gearment-catalog' => [
                'id' => 'sync-gearment-catalog',
                'title' => 'Import catalog Gearment',
                'description' => 'Nhập catalog, màu, size và ảnh mockup mới.',
                'command' => 'python -m app.cli sync-gearment-catalog --apply --no-truncate',
                'arguments' => ['sync-gearment-catalog', '--apply', '--no-truncate'],
                'timeout' => 900,
                'confirmation' => 'Dữ liệu catalog sẽ được cập nhật từ Gearment. Tiếp tục?',
                'success' => 'Đã import catalog Gearment.',
            ],
            'refresh-gearment-size-charts' => [
                'id' => 'refresh-gearment-size-charts',
                'title' => 'Cập nhật bảng size',
                'description' => 'Tải lại bảng size cho catalog Gearment.',
                'command' => 'python -m app.cli refresh-gearment-size-charts',
                'arguments' => ['refresh-gearment-size-charts'],
                'timeout' => 900,
                'confirmation' => 'Bảng size hiện tại sẽ được cập nhật. Tiếp tục?',
                'success' => 'Đã cập nhật bảng size.',
            ],
            'seed-product-showcase' => [
                'id' => 'seed-product-showcase',
                'title' => 'Tạo sản phẩm trưng bày',
                'description' => 'Phân bổ sản phẩm mẫu cho các catalog đang bán.',
                'command' => 'python -m app.cli seed-product-showcase --per-category 4',
                'arguments' => ['seed-product-showcase', '--per-category', '4'],
                'timeout' => 300,
                'confirmation' => 'Liên kết product–catalog sẽ được cập nhật. Tiếp tục?',
                'success' => 'Đã tạo sản phẩm trưng bày.',
            ],
        ];
    }

    public function products(Request $request): Response
    {
        $filters = $this->filters($request);
        $query = $this->table('products as p')->join('designs as d', 'd.id', '=', 'p.design_id')
            ->select('p.*', 'd.name as design_name');
        if ($filters['q'] !== '') {
            $query->where(fn (Builder $q) => $q->where('p.title', 'like', '%'.$filters['q'].'%')->orWhere('p.slug', 'like', '%'.$filters['q'].'%'));
        }
        if ($filters['status'] !== '') {
            $query->where('p.status', $filters['status']);
        }

        $products = $query->orderByDesc('p.id')->paginate(20)->withQueryString();
        $availableCatalogs = $this->table('catalogs as c')
            ->where('c.active', true)
            ->whereExists(fn (Builder $q) => $q->from('catalog_assets as ca')
                ->whereColumn('ca.catalog_id', 'c.id')
                ->where('ca.status', 'active'))
            ->whereExists(fn (Builder $q) => $q->from('catalog_variants as cv')
                ->join('catalog_colors as color', 'color.id', '=', 'cv.color_id')
                ->whereColumn('cv.catalog_id', 'c.id')
                ->where('cv.active', true)
                ->where('color.active', true))
            ->select('c.slug', 'c.name')
            ->groupBy('c.id', 'c.slug', 'c.name', 'c.sort_order')
            ->orderBy('c.sort_order')
            ->orderBy('c.name')
            ->get()
            ->all();
        $products->getCollection()->transform(function (object $product) use ($availableCatalogs): object {
            $product->design_image_url = route('products.design-image', $product->id);
            $product->available_catalogs = $availableCatalogs;

            return $product;
        });

        return Inertia::render('products/index', [
            'products' => $products,
            'filters' => $filters,
            'importFolders' => $this->importFolders(),
        ]);
    }

    public function productDesignImage(int $product)
    {
        $sourcePath = $this->table('products as p')
            ->join('designs as d', 'd.id', '=', 'p.design_id')
            ->where('p.id', $product)
            ->value('d.source_path');
        $filename = is_string($sourcePath) ? basename($sourcePath) : '';
        $image = $filename === '' ? null : collect(File::allFiles($this->designRoot()))
            ->first(fn (\SplFileInfo $file) => $file->getFilename() === $filename);
        abort_unless($image instanceof \SplFileInfo, 404);

        return response()->file($image->getPathname(), ['Cache-Control' => 'private, max-age=3600']);
    }

    public function productForm(?int $product = null): Response
    {
        return Inertia::render('products/form', [
            'product' => $product === null ? null : $this->find('products', $product),
            'designs' => $this->table('designs')->select('id', 'name', 'status')->orderBy('name')->get(),
            'catalogs' => $this->table('catalogs')->select('id', 'name')->where('active', true)->orderBy('name')->get(),
            'variants' => $product === null ? [] : $this->table('product_variants as pv')
                ->join('catalog_variants as cv', 'cv.id', '=', 'pv.catalog_variant_id')
                ->join('catalogs as c', 'c.id', '=', 'cv.catalog_id')
                ->select('pv.id', 'pv.sku', 'pv.price_minor', 'pv.currency', 'pv.active', 'c.name as catalog_name')->where('pv.product_id', $product)->orderBy('pv.sku')->get(),
        ]);
    }

    public function saveProduct(Request $request, ?int $product = null): RedirectResponse
    {
        if ($product !== null) {
            $this->find('products', $product);
        }
        $data = $request->validate([
            'title' => 'required|string|max:255',
            'slug' => ['required', 'string', 'max:190', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', Rule::unique('store.products', 'slug')->ignore($product)],
            'description' => 'nullable|string|max:60000',
            'design_id' => ['required', 'integer', Rule::exists('store.designs', 'id')],
            'brand' => 'required|string|max:190',
            'status' => ['required', Rule::in(['draft', 'active', 'archived'])],
            'seo_title' => 'nullable|string|max:255',
            'seo_description' => 'nullable|string|max:1000',
            'catalog_ids' => [$product === null ? 'required' : 'prohibited', 'array', 'min:1'],
            'catalog_ids.*' => ['integer', 'distinct', Rule::exists('store.catalogs', 'id')->where('active', true)],
        ]);
        $id = $this->db()->transaction(function () use ($request, $product, $data): int {
            $catalogIds = $data['catalog_ids'] ?? [];
            unset($data['catalog_ids']);
            $before = $product === null ? null : $this->table('products')->where('id', $product)->lockForUpdate()->first();
            if ($data['status'] === 'active' && ! $this->table('designs')->where('id', $data['design_id'])->where('status', 'active')->exists()) {
                throw ValidationException::withMessages(['status' => 'Activate the design through the importer before publishing this product.']);
            }
            if ($before !== null && (int) $before->design_id !== (int) $data['design_id']) {
                throw ValidationException::withMessages(['design_id' => 'The design of an existing product cannot be changed. Create a new product instead.']);
            }
            $data['updated_at'] = now();
            $data['published_at'] = $data['status'] === 'active' ? ($before->published_at ?? now()) : ($before->published_at ?? null);
            if ($product === null) {
                $data['public_id'] = (string) Str::uuid();
                $data['created_at'] = now();
                $product = $this->table('products')->insertGetId($data);
                foreach ($catalogIds as $catalogId) {
                    $this->table('product_catalogs')->insert(['product_id' => $product, 'catalog_id' => $catalogId, 'active' => true]);
                    $variants = $this->table('catalog_variants as cv')
                        ->join('catalog_colors as color', 'color.id', '=', 'cv.color_id')
                        ->join('catalog_sizes as size', 'size.id', '=', 'cv.size_id')
                        ->where('cv.catalog_id', $catalogId)->where('cv.active', true)->where('color.active', true)->where('size.active', true)
                        ->select('cv.*')->get();
                    if ($variants->isEmpty()) {
                        throw ValidationException::withMessages(['catalog_ids' => 'Each selected catalog needs at least one active variant. Import its variants first.']);
                    }
                    foreach ($variants as $variant) {
                        // Matches the API stable_variant_id for virtual catalog routes.
                        $publicId = 'pv_'.substr(hash('sha256', $data['public_id'].'|'.$variant->public_id), 0, 28);
                        $this->table('product_variants')->insert([
                            'public_id' => $publicId, 'product_id' => $product, 'catalog_variant_id' => $variant->id,
                            'sku' => 'TV-'.$product.'-'.$variant->id, 'price_minor' => $variant->default_price_minor,
                            'currency' => $variant->currency, 'active' => true,
                        ]);
                    }
                }
            } else {
                $this->table('products')->where('id', $product)->update($data);
            }
            $this->audit($request, 'product', $product, (array) $before, $data);

            return $product;
        });

        return to_route('products.edit', $id)->with('success', 'Product saved.');
    }

    public function catalogs(Request $request): Response
    {
        $filters = $this->filters($request);
        $variantPrices = $this->table('catalog_variants')
            ->select('catalog_id')
            ->selectRaw('MIN(default_price_minor) as price_minor')
            ->selectRaw('MIN(base_price_minor) as base_price_minor')
            ->selectRaw('MIN(currency) as currency')
            ->selectRaw('COUNT(*) as variant_count')
            ->groupBy('catalog_id');
        $query = $this->table('catalogs')
            ->leftJoinSub($variantPrices, 'variant_prices', fn (Builder $join) => $join
                ->on('variant_prices.catalog_id', '=', 'catalogs.id'))
            ->select(
                'catalogs.id',
                'catalogs.name',
                'catalogs.slug',
                'catalogs.provider',
                'catalogs.product_type',
                'catalogs.brand',
                'catalogs.active',
                'catalogs.sort_order',
                'variant_prices.price_minor',
                'variant_prices.base_price_minor',
                'variant_prices.currency',
                'variant_prices.variant_count',
            );
        $category = $request->string('category')->toString();
        if ($category !== '') {
            $query->whereExists(fn (Builder $q) => $q
                ->from('catalog_assets as ca')
                ->whereColumn('ca.catalog_id', 'catalogs.id')
                ->where('ca.status', 'active')
                ->where('ca.local_path', 'like', 'mockup/'.$category.'/%'));
        }
        if ($filters['q'] !== '') {
            $query->where(fn (Builder $q) => $q->where('name', 'like', '%'.$filters['q'].'%')->orWhere('slug', 'like', '%'.$filters['q'].'%'));
        }
        if ($filters['status'] !== '') {
            $query->where('catalogs.active', $filters['status'] === 'active');
        }

        $catalogs = $query->orderBy('sort_order')->orderBy('name')->paginate(20)->withQueryString();
        $previewAreas = $this->catalogPreviewAreas(
            $catalogs->getCollection()->pluck('slug')->filter()->values()->all(),
        );

        $catalogs->getCollection()->transform(function (object $catalog) use ($previewAreas): object {
            $catalog->price_minor = $catalog->price_minor === null ? null : (int) $catalog->price_minor;
            $catalog->base_price_minor = $catalog->base_price_minor === null ? null : (int) $catalog->base_price_minor;
            $catalog->currency = $catalog->currency === null ? null : (string) $catalog->currency;
            $catalog->variant_count = (int) $catalog->variant_count;
            $catalog->thumbnail_url = route('catalog.asset', [
                'catalog' => $catalog->id,
                'v' => 'black-blank-v2',
            ]);
            $catalog->print_area = $previewAreas[$catalog->slug] ?? null;
            if (is_array($catalog->print_area)) {
                $catalog->print_area['assets'] = collect($catalog->print_area['assets'] ?? [])
                    ->map(fn (array $asset): array => [
                        ...$asset,
                        'image_url' => route('catalog.asset', [
                            'catalog' => $catalog->id,
                            'path' => $asset['source_path'],
                            'v' => 'mockup-'.$asset['metadata_id'],
                        ]),
                    ])
                    ->all();
            }

            return $catalog;
        });

        return Inertia::render('catalog/index', [
            'catalogs' => $catalogs,
            'filters' => [...$filters, 'category' => $category],
            'printAreaPlaceholderUrl' => route('catalog.print-area-placeholder', [
                'v' => 'print-area-v4',
            ]),
        ]);
    }

    public function catalogAssetImage(Request $request, int $catalog)
    {
        $root = realpath($this->apiPath().'/public');
        $catalogRecord = $this->table('catalogs')->find($catalog, ['slug', 'name', 'product_type']);

        $requestedPath = $request->string('path')->toString();
        if ($requestedPath !== '') {
            abort_unless(
                $catalogRecord?->slug !== null
                    && str_starts_with($requestedPath, 'mockup/')
                    && ! str_contains($requestedPath, '..')
                    && ! str_ends_with(strtolower($requestedPath), '/avatar-1.png')
                    && str_contains($requestedPath, '/'.$catalogRecord->slug.'/'),
                404,
            );
            $file = $root === false ? null : $this->resolvePublicAsset($requestedPath, $root);
            abort_unless($file !== null, 404);

            return response()->file($file, ['Cache-Control' => 'private, max-age=3600']);
        }

        $catalogIdentity = strtolower(implode(' ', array_filter([
            $catalogRecord?->name,
            $catalogRecord?->slug,
            $catalogRecord?->product_type,
        ])));
        $isApparel = $catalogRecord?->product_type === 'apparel'
            || Str::contains($catalogIdentity, ['shirt', 'tee', 'hoodie', 'sweatshirt', 'tank', 'crewneck']);

        if ($catalogRecord?->slug !== null && $isApparel) {
            $mockupPath = implode('/', [
                'catalog-preview',
                rawurlencode($catalogRecord->slug),
                'black',
                'blank.webp',
            ]);

            try {
                $mockup = Http::accept('image/webp')
                    ->timeout(8)
                    ->get($this->mockupApiUrl().'/'.$mockupPath);

                if (
                    $mockup->successful()
                    && str_starts_with((string) $mockup->header('Content-Type'), 'image/')
                ) {
                    return response($mockup->body(), 200, [
                        'Content-Type' => $mockup->header('Content-Type', 'image/webp'),
                        'Cache-Control' => 'private, max-age=3600',
                    ]);
                }
            } catch (ConnectionException) {
                // Keep the local catalog asset as a fallback while the renderer is offline.
            }
        }

        $frontMockup = $catalogRecord?->slug === null
            ? null
            : 'mockup/'.$this->modelMockupCategory($catalog).'/'.$catalogRecord->slug.'/front.png';
        $file = $root === false ? null : $this->resolvePublicAsset($frontMockup, $root);

        if ($file === null && $root !== false) {
            $path = $this->table('catalog_assets')->where('catalog_id', $catalog)->where('status', 'active')->orderBy('id')->value('local_path');
            $file = $this->resolvePublicAsset($path, $root);
        }

        if ($file === null && $root !== false) {
            $templatePath = $this->table('mockup_templates')
                ->where('catalog_id', $catalog)
                ->where('active', true)
                ->orderBy('id')
                ->value('base_source');
            $file = $this->resolvePublicAsset($templatePath, $root);
        }

        if ($file === null && $root !== false) {
            $fallbacks = array_filter([
                $catalogRecord?->slug === null ? null : 'mockup/'.$catalogRecord->slug.'/avatar-1.png',
                $catalogRecord?->product_type === 'apparel'
                    ? 'mockup/lightweight-t-shirt-980/avatar-1.png'
                    : 'mockup/classic-t-shirt/avatar-1.png',
            ]);

            foreach ($fallbacks as $fallback) {
                $file = $this->resolvePublicAsset($fallback, $root);
                if ($file !== null) {
                    break;
                }
            }
        }

        abort_unless($file !== null, 404);

        return response()->file($file, ['Cache-Control' => 'private, max-age=3600']);
    }

    public function catalogPrintAreaPlaceholderImage()
    {
        $root = realpath($this->apiPath().'/public');
        $file = $root === false
            ? null
            : $this->resolvePublicAsset('mockup/placeholder/print-area-white.svg', $root);

        abort_unless($file !== null, 404);

        return response()->file($file, [
            'Cache-Control' => 'private, max-age=31536000, immutable',
        ]);
    }

    public function catalogForm(?int $catalog = null): Response
    {
        return Inertia::render('catalog/form', [
            'catalog' => $catalog === null ? null : $this->table('catalogs')->select('id', 'name', 'slug', 'product_type', 'brand', 'material', 'active', 'sort_order', 'description_override', 'model_mockup_prompt', 'provider')->find($catalog) ?? abort(404),
            'variants' => $catalog === null ? [] : $this->table('catalog_variants as v')
                ->join('catalog_colors as c', 'c.id', '=', 'v.color_id')->join('catalog_sizes as s', 's.id', '=', 'v.size_id')
                ->where('v.catalog_id', $catalog)->select('v.id', 'v.sku', 'v.default_price_minor', 'v.currency', 'v.stock_policy', 'v.stock_quantity', 'v.active', 'c.name as color', 's.label as size')->orderBy('c.name')->orderBy('s.sort_order')->get(),
            'colors' => $catalog === null ? [] : $this->table('catalog_colors')
                ->where('catalog_id', $catalog)->where('active', true)
                ->select('id', 'slug', 'name')->orderBy('sort_order')->get(),
            'modelMockups' => $catalog === null ? [] : $this->table('mockup_templates as template')
                ->join('catalog_colors as color', 'color.id', '=', 'template.color_id')
                ->where('template.catalog_id', $catalog)
                ->where('template.renderer_version', 'like', 'ai-model-v1:%')
                ->select('template.id', 'template.style', 'template.placement', 'template.base_source', 'template.template_width', 'template.template_height', 'color.name as color_name')
                ->orderBy('color.sort_order')->orderBy('template.style')->orderBy('template.placement')->get(),
        ]);
    }

    public function saveCatalog(Request $request, ?int $catalog = null): RedirectResponse
    {
        if ($catalog !== null) {
            $this->find('catalogs', $catalog);
        }
        $data = $request->validate([
            'name' => 'required|string|max:190',
            'slug' => ['required', 'string', 'max:190', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', Rule::unique('store.catalogs', 'slug')->ignore($catalog)],
            'product_type' => 'required|string|max:100', 'brand' => 'nullable|string|max:190', 'material' => 'nullable|string|max:190',
            'description_override' => 'nullable|string|max:60000', 'model_mockup_prompt' => 'nullable|string|max:20000',
            'active' => 'required|boolean', 'sort_order' => 'required|integer|min:0|max:2147483647',
        ]);
        $id = $this->db()->transaction(function () use ($request, $catalog, $data): int {
            $before = $catalog === null ? null : $this->table('catalogs')->where('id', $catalog)->lockForUpdate()->first();
            $data['updated_at'] = now();
            if ($catalog === null) {
                $data['public_id'] = (string) Str::uuid();
                $data['provider'] = 'manual';
                $data['created_at'] = now();
                $catalog = $this->table('catalogs')->insertGetId($data);
            } else {
                $this->table('catalogs')->where('id', $catalog)->update($data);
            }
            $this->audit($request, 'catalog', $catalog, array_intersect_key((array) $before, $data), $data);

            return $catalog;
        });

        return to_route('catalog.edit', $id)->with('success', 'Catalog saved.');
    }

    public function storeCatalogModelMockup(Request $request, int $catalog): RedirectResponse
    {
        $catalogRecord = $this->find('catalogs', $catalog);
        $data = $request->validate([
            'color_id' => [
                'required',
                'integer',
                Rule::exists('store.catalog_colors', 'id')->where(
                    fn (Builder $query): Builder => $query->where('catalog_id', $catalog)->where('active', true)
                ),
            ],
            'style' => ['required', Rule::in(['men', 'women'])],
            'placement' => ['required', Rule::in(['front', 'left-chest', 'back'])],
            'asset' => 'required|file|mimes:jpg,jpeg,png,webp|max:20480',
            'print_area_x' => 'required|numeric|min:0|max:100',
            'print_area_y' => 'required|numeric|min:0|max:100',
            'print_area_width' => 'required|numeric|min:1|max:100',
            'print_area_height' => 'required|numeric|min:1|max:100',
        ]);
        if ($data['print_area_x'] + $data['print_area_width'] > 100 || $data['print_area_y'] + $data['print_area_height'] > 100) {
            throw ValidationException::withMessages(['asset' => 'Print area must stay within the image bounds.']);
        }

        $color = $this->table('catalog_colors')->where('id', $data['color_id'])->where('catalog_id', $catalog)->first(['id', 'slug']);
        abort_unless($color !== null, 404);
        $asset = $request->file('asset');
        $image = $asset === null ? false : getimagesize($asset->getRealPath());
        if ($image === false || $image[0] < 500 || $image[1] < 500) {
            throw ValidationException::withMessages(['asset' => 'Upload a model mockup that is at least 500 by 500 pixels.']);
        }

        $extension = strtolower($asset->extension() ?: $asset->getClientOriginalExtension());
        $filename = implode('_', [
            $data['style'],
            $color->slug,
            str_replace('-', '_', $data['placement']),
        ]).'.'.$extension;
        $category = $this->modelMockupCategory($catalog);
        $directory = $this->modelMockupRoot().DIRECTORY_SEPARATOR.$category.DIRECTORY_SEPARATOR.$catalogRecord->slug;
        File::ensureDirectoryExists($directory);
        $asset->move($directory, $filename);

        $baseSource = 'mockup/'.$category.'/'.$catalogRecord->slug.'/'.$filename;
        $printAreaJson = json_encode([
            'x' => (float) $data['print_area_x'] / 100,
            'y' => (float) $data['print_area_y'] / 100,
            'width' => (float) $data['print_area_width'] / 100,
            'height' => (float) $data['print_area_height'] / 100,
        ], JSON_THROW_ON_ERROR);
        $templatePayload = [
            'base_source' => $baseSource,
            'print_area_json' => $printAreaJson,
            'template_width' => $image[0],
            'template_height' => $image[1],
            'renderer_version' => 'ai-model-v1:'.hash(
                'sha256',
                hash_file('sha256', $directory.DIRECTORY_SEPARATOR.$filename).':'.$printAreaJson
            ),
            'active' => true,
        ];

        $this->db()->transaction(function () use ($request, $catalog, $color, $data, $templatePayload): void {
            $existing = $this->table('mockup_templates')
                ->where('catalog_id', $catalog)->where('color_id', $color->id)
                ->where('style', $data['style'])->where('placement', $data['placement'])
                ->lockForUpdate()->first();
            if ($existing === null) {
                $templateId = $this->table('mockup_templates')->insertGetId([
                    'public_id' => (string) Str::uuid(),
                    'catalog_id' => $catalog,
                    'color_id' => $color->id,
                    'style' => $data['style'],
                    'placement' => $data['placement'],
                    ...$templatePayload,
                ]);
            } else {
                $templateId = $existing->id;
                $this->table('mockup_templates')->where('id', $templateId)->update($templatePayload);
            }
            $this->audit($request, 'catalog-model-mockup', $templateId, (array) $existing, $templatePayload);
        });

        return to_route('catalog.edit', $catalog)->with('success', 'Model mockup template saved.');
    }

    public function catalogModelMockupImage(int $catalog, int $template)
    {
        $source = $this->table('mockup_templates')
            ->where('id', $template)->where('catalog_id', $catalog)
            ->where('renderer_version', 'like', 'ai-model-v1:%')
            ->value('base_source');
        $root = realpath($this->apiPath().'/public');
        $file = $root === false ? null : $this->resolvePublicAsset($source, $root);
        abort_unless($file !== null, 404);

        return response()->file($file, ['Cache-Control' => 'private, max-age=3600']);
    }

    public function saveCatalogVariant(Request $request, int $catalog, int $variant): RedirectResponse
    {
        $data = $request->validate([
            'default_price_minor' => 'required|integer|min:0|max:4294967295',
            'stock_quantity' => 'required|integer|min:0|max:2147483647',
            'stock_policy' => ['required', Rule::in(['in_stock', 'continue'])], 'active' => 'required|boolean',
        ]);
        $this->db()->transaction(function () use ($request, $catalog, $variant, $data): void {
            $before = $this->table('catalog_variants')->where('catalog_id', $catalog)->where('id', $variant)->lockForUpdate()->first() ?? abort(404);
            $this->table('catalog_variants')->where('id', $variant)->update($data);
            // Catalog-specific storefront pages price virtual variants from this column.
            $this->table('product_variants')->where('catalog_variant_id', $variant)->update(['price_minor' => $data['default_price_minor']]);
            $this->table('product_variants')->where('catalog_variant_id', $variant)->where('compare_at_minor', '<=', $data['default_price_minor'])->update(['compare_at_minor' => null]);
            $this->audit($request, 'catalog_variant', $variant, array_intersect_key((array) $before, $data), $data);
        });

        return back()->with('success', 'Variant saved. Selling prices updated for all linked products.');
    }

    public function updateCatalogPrice(Request $request, int $catalog): RedirectResponse
    {
        $data = $request->validate([
            'price_minor' => 'required|integer|min:0|max:4294967295',
        ]);

        $this->db()->transaction(function () use ($request, $catalog, $data): void {
            $this->table('catalogs')->where('id', $catalog)->lockForUpdate()->first() ?? abort(404);
            $variants = $this->table('catalog_variants')
                ->where('catalog_id', $catalog)
                ->lockForUpdate()
                ->get(['id', 'default_price_minor']);

            if ($variants->isEmpty()) {
                throw ValidationException::withMessages([
                    'price_minor' => 'This catalog has no variants, so there is no price to update.',
                ]);
            }

            $variantIds = $variants->pluck('id')->all();
            $before = [
                'default_price_minor' => $variants->pluck('default_price_minor')->unique()->values()->all(),
                'variant_count' => count($variantIds),
            ];
            $after = [
                'default_price_minor' => $data['price_minor'],
                'variant_count' => count($variantIds),
            ];

            $this->table('catalog_variants')
                ->whereIn('id', $variantIds)
                ->update(['default_price_minor' => $data['price_minor']]);
            $this->table('catalog_variants')
                ->whereIn('id', $variantIds)
                ->where('base_price_minor', '<=', $data['price_minor'])
                ->update(['base_price_minor' => null]);
            $this->table('product_variants')
                ->whereIn('catalog_variant_id', $variantIds)
                ->update(['price_minor' => $data['price_minor']]);
            $this->table('product_variants')
                ->whereIn('catalog_variant_id', $variantIds)
                ->where('compare_at_minor', '<=', $data['price_minor'])
                ->update(['compare_at_minor' => null]);
            $this->audit($request, 'catalog_price', $catalog, $before, $after);
        });

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Catalog price updated for all variants.',
        ]);

        return back();
    }

    public function updateCatalogBasePrice(Request $request, int $catalog): RedirectResponse
    {
        $data = $request->validate([
            'base_price_minor' => 'nullable|integer|min:0|max:4294967295',
        ]);

        $this->db()->transaction(function () use ($request, $catalog, $data): void {
            $this->table('catalogs')->where('id', $catalog)->lockForUpdate()->first() ?? abort(404);
            $variants = $this->table('catalog_variants')
                ->where('catalog_id', $catalog)
                ->lockForUpdate()
                ->get(['id', 'default_price_minor', 'base_price_minor']);

            if ($variants->isEmpty()) {
                throw ValidationException::withMessages([
                    'base_price_minor' => 'This catalog has no variants, so there is no base price to update.',
                ]);
            }

            $basePrice = $data['base_price_minor'];
            if ($basePrice !== null && $variants->contains(fn (object $variant): bool => $basePrice <= $variant->default_price_minor)) {
                throw ValidationException::withMessages([
                    'base_price_minor' => 'Base price must be greater than the selling price.',
                ]);
            }

            $variantIds = $variants->pluck('id')->all();
            $before = [
                'base_price_minor' => $variants->pluck('base_price_minor')->unique()->values()->all(),
                'variant_count' => count($variantIds),
            ];
            $after = [
                'base_price_minor' => $basePrice,
                'variant_count' => count($variantIds),
            ];

            $this->table('catalog_variants')
                ->whereIn('id', $variantIds)
                ->update(['base_price_minor' => $basePrice]);
            $this->audit($request, 'catalog_base_price', $catalog, $before, $after);
        });

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Catalog base price updated for all variants.',
        ]);

        return back();
    }

    public function updateCatalogPrintArea(Request $request, int $catalog): RedirectResponse
    {
        $data = $request->validate([
            'metadata_id' => 'required|integer|min:1',
            'x' => 'required|numeric|min:0|max:1',
            'y' => 'required|numeric|min:0|max:1',
            'width' => 'required|numeric|gt:0|max:1',
            'height' => 'nullable|numeric|gt:0|max:1',
        ]);

        $this->db()->transaction(function () use ($request, $catalog, $data): void {
            $this->table('catalogs')->where('id', $catalog)->lockForUpdate()->first() ?? abort(404);
            $metadata = $this->table('catalog_mockup_metadata')
                ->where('catalog_id', $catalog)
                ->where('id', $data['metadata_id'])
                ->lockForUpdate()
                ->first();

            if ($metadata === null) {
                throw ValidationException::withMessages([
                    'print_area' => 'Run Analyze catalog mockups before editing this catalog.',
                ]);
            }

            try {
                $stored = json_decode(
                    (string) $metadata->print_area_json,
                    true,
                    512,
                    JSON_THROW_ON_ERROR,
                );
            } catch (\JsonException) {
                throw ValidationException::withMessages([
                    'print_area' => 'This catalog has invalid print-area metadata. Run Analyze catalog mockups first.',
                ]);
            }

            if (! is_array($stored)) {
                throw ValidationException::withMessages([
                    'print_area' => 'This catalog has invalid print-area metadata. Run Analyze catalog mockups first.',
                ]);
            }

            $templateWidth = (int) $metadata->template_width;
            $templateHeight = (int) $metadata->template_height;
            if ($templateWidth < 1 || $templateHeight < 1) {
                throw ValidationException::withMessages([
                    'print_area' => 'This mockup has invalid template dimensions. Run Analyze catalog mockups first.',
                ]);
            }

            $area = [
                'x' => (float) $data['x'],
                'y' => (float) $data['y'],
                'width' => (float) $data['width'],
                'height' => (float) $data['width'] * $templateWidth / $templateHeight * 6 / 5,
            ];
            if ($this->catalogPrintAreaRect($area) === null) {
                throw ValidationException::withMessages([
                    'print_area' => 'X and Y must keep the complete print area inside the mockup.',
                ]);
            }

            $regions = collect(is_array($stored['regions'] ?? null) ? $stored['regions'] : [])
                ->map(fn ($region) => $this->catalogPrintAreaRect($region))
                ->filter()
                ->values()
                ->all();
            if ($regions === []) {
                $regions = [$area];
            } else {
                $regions[0] = $area;
            }

            $updated = [
                ...$stored,
                ...$area,
                'regions' => $regions,
            ];
            $this->table('catalog_mockup_metadata')
                ->where('id', $metadata->id)
                ->update([
                    'print_area_json' => json_encode($updated, JSON_THROW_ON_ERROR),
                    'analysis_version' => 'manual-print-area-v1',
                    'status' => 'ready',
                    'error_message' => null,
                    'analyzed_at' => now(),
                ]);

            $this->audit($request, 'catalog_print_area', $catalog, [
                'metadata_id' => (int) $metadata->id,
                'print_area' => $this->catalogPrintAreaRect($stored),
            ], [
                'metadata_id' => (int) $metadata->id,
                'print_area' => $area,
            ]);
        });

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Catalog print-area position and size updated.',
        ]);

        return back();
    }

    public function orders(Request $request): Response
    {
        $filters = $this->filters($request);
        $query = $this->table('orders');
        if ($filters['q'] !== '') {
            $query->where(fn (Builder $q) => $q->where('order_number', 'like', '%'.$filters['q'].'%')->orWhere('email', 'like', '%'.$filters['q'].'%'));
        }
        if ($filters['status'] !== '') {
            $query->where('fulfillment_status', $filters['status']);
        }

        return Inertia::render('orders/index', ['orders' => $query->orderByDesc('id')->paginate(20)->withQueryString(), 'filters' => $filters]);
    }

    /** @return list<string> */
    private function transitions(object $order): array
    {
        if ($order->payment_status !== 'paid') {
            return [];
        }

        return match ($order->fulfillment_status) {
            'pending' => ['processing'],
            'processing' => ['shipped'],
            'shipped' => ['delivered'],
            default => [],
        };
    }

    public function order(int $order): Response
    {
        $record = $this->find('orders', $order);

        return Inertia::render('orders/show', [
            'order' => $record, 'items' => $this->table('order_items')->where('order_id', $order)->get(),
            'addresses' => $this->table('order_addresses')->where('order_id', $order)->get(),
            'payment' => $this->table('checkout_attempts')->where('order_id', $order)->select('stripe_session_id', 'shipping_method', 'payment_intent_id')->first(),
            'transitions' => $this->transitions($record),
        ]);
    }

    public function updateOrder(Request $request, int $order): RedirectResponse
    {
        $data = $request->validate(['fulfillment_status' => 'required|string|max:32', 'expected_status' => 'required|string|max:32']);
        $this->db()->transaction(function () use ($request, $order, $data): void {
            $before = $this->table('orders')->where('id', $order)->lockForUpdate()->first() ?? abort(404);
            if ($before->fulfillment_status !== $data['expected_status'] || ! in_array($data['fulfillment_status'], $this->transitions($before), true)) {
                throw ValidationException::withMessages(['fulfillment_status' => 'This transition is unavailable. Refresh the order and check its payment status.']);
            }
            $this->table('orders')->where('id', $order)->update(['fulfillment_status' => $data['fulfillment_status']]);
            $this->audit($request, 'order', $order, ['fulfillment_status' => $before->fulfillment_status], ['fulfillment_status' => $data['fulfillment_status']]);
        });

        return back()->with('success', 'Fulfillment status updated.');
    }
}
