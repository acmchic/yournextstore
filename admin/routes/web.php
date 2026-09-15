<?php

use App\Http\Controllers\Store\CheckoutSettingsController;
use App\Http\Controllers\Store\CollectionController;
use App\Http\Controllers\Store\LegalPageController;
use App\Http\Controllers\Store\StoreController;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/dashboard')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('checkout-settings', [CheckoutSettingsController::class, 'index'])->name('checkout-settings.index');
    Route::put('checkout-settings', [CheckoutSettingsController::class, 'save'])->name('checkout-settings.update');
    Route::get('carts', [CheckoutSettingsController::class, 'carts'])->name('carts.index');
    Route::get('collections', [CollectionController::class, 'index'])->name('collections.index');
    Route::post('collections', [CollectionController::class, 'save'])->name('collections.store');
    Route::put('collections/{collection}', [CollectionController::class, 'save'])->whereNumber('collection')->name('collections.update');
    Route::get('legal', [LegalPageController::class, 'index'])->name('legal.index');
    Route::post('legal', [LegalPageController::class, 'save'])->name('legal.store');
    Route::put('legal/{page}', [LegalPageController::class, 'save'])->whereNumber('page')->name('legal.update');
    Route::get('dashboard', [StoreController::class, 'dashboard'])->name('dashboard');
    Route::get('operations', [StoreController::class, 'operations'])->name('operations.index');
    Route::post('operations/{operation}', [StoreController::class, 'runOperation'])->name('operations.run');
    Route::post('products/import', [StoreController::class, 'importProducts'])->name('products.import');
    Route::get('products', [StoreController::class, 'products'])->name('products.index');
    Route::get('products/{product}/design-image', [StoreController::class, 'productDesignImage'])->whereNumber('product')->name('products.design-image');
    Route::get('products/create', [StoreController::class, 'productForm'])->name('products.create');
    Route::post('products', [StoreController::class, 'saveProduct'])->name('products.store');
    Route::get('products/{product}/edit', [StoreController::class, 'productForm'])->whereNumber('product')->name('products.edit');
    Route::put('products/{product}', [StoreController::class, 'saveProduct'])->whereNumber('product')->name('products.update');
    Route::get('catalog', [StoreController::class, 'catalogs'])->name('catalog.index');
    Route::get('catalog/create', [StoreController::class, 'catalogForm'])->name('catalog.create');
    Route::post('catalog', [StoreController::class, 'saveCatalog'])->name('catalog.store');
    Route::get('catalog/{catalog}/edit', [StoreController::class, 'catalogForm'])->whereNumber('catalog')->name('catalog.edit');
    Route::get('catalog/{catalog}/asset', [StoreController::class, 'catalogAssetImage'])->whereNumber('catalog')->name('catalog.asset');
    Route::put('catalog/{catalog}', [StoreController::class, 'saveCatalog'])->whereNumber('catalog')->name('catalog.update');
    Route::post('catalog/{catalog}/model-mockups', [StoreController::class, 'storeCatalogModelMockup'])->whereNumber('catalog')->name('catalog.model-mockups.store');
    Route::get('catalog/{catalog}/model-mockups/{template}/asset', [StoreController::class, 'catalogModelMockupImage'])->whereNumber(['catalog', 'template'])->name('catalog.model-mockups.asset');
    Route::put('catalog/{catalog}/variants/{variant}', [StoreController::class, 'saveCatalogVariant'])->whereNumber(['catalog', 'variant'])->name('catalog.variants.update');
    Route::get('orders', [StoreController::class, 'orders'])->name('orders.index');
    Route::get('orders/{order}', [StoreController::class, 'order'])->whereNumber('order')->name('orders.show');
    Route::patch('orders/{order}', [StoreController::class, 'updateOrder'])->whereNumber('order')->name('orders.update');
});

require __DIR__.'/settings.php';
