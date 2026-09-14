insert into catalogs(public_id, slug, name, product_type, material, brand, active, sort_order)
values ('cat_tshirt', 't-shirt', 'Unisex T-Shirt', 'apparel', '100% cotton', 'Own Brand', true, 10)
on duplicate key update name=values(name), active=values(active);

insert into catalog_colors(catalog_id, slug, name, hex, sort_order)
select id, 'black', 'Black', '#111111', 10 from catalogs where slug='t-shirt'
union all select id, 'white', 'White', '#FFFFFF', 20 from catalogs where slug='t-shirt'
union all select id, 'navy', 'Navy', '#172554', 30 from catalogs where slug='t-shirt'
union all select id, 'yam', 'Yam', '#C56A3A', 40 from catalogs where slug='t-shirt'
on duplicate key update name=values(name), hex=values(hex), sort_order=values(sort_order);

insert into catalog_sizes(catalog_id, code, label, sort_order)
select id, 'S', 'Small', 10 from catalogs where slug='t-shirt'
union all select id, 'M', 'Medium', 20 from catalogs where slug='t-shirt'
union all select id, 'L', 'Large', 30 from catalogs where slug='t-shirt'
union all select id, 'XL', 'Extra Large', 40 from catalogs where slug='t-shirt'
union all select id, '2XL', '2X Large', 50 from catalogs where slug='t-shirt'
on duplicate key update label=values(label), sort_order=values(sort_order);

insert into catalog_variants(public_id, catalog_id, color_id, size_id, sku, default_price_minor, currency, stock_policy, stock_quantity)
select concat('cv_', c.slug, '_', lower(s.code)), c.catalog_id, c.id, s.id,
       upper(concat('BLANK-TSHIRT-', c.slug, '-', s.code)), 2999, 'USD', 'continue', 0
from catalog_colors c
join catalog_sizes s on s.catalog_id=c.catalog_id
join catalogs ca on ca.id=c.catalog_id and ca.slug='t-shirt'
on duplicate key update default_price_minor=values(default_price_minor), active=true;

insert into mockup_templates(public_id, catalog_id, color_id, style, placement, base_source, renderer_version)
select concat('tpl_tshirt_', c.slug, '_flat_front'), c.catalog_id, c.id, 'flat', 'front', concat('mockup/t-shirt/', c.slug, '-front.png'), 'v3-sharp'
from catalog_colors c join catalogs ca on ca.id=c.catalog_id and ca.slug='t-shirt'
union all
select concat('tpl_tshirt_', c.slug, '_flat_left_chest'), c.catalog_id, c.id, 'flat', 'left-chest', concat('mockup/t-shirt/', c.slug, '-front.png'), 'v3-sharp'
from catalog_colors c join catalogs ca on ca.id=c.catalog_id and ca.slug='t-shirt'
union all
select concat('tpl_tshirt_', c.slug, '_flat_back'), c.catalog_id, c.id, 'flat', 'back', concat('mockup/t-shirt/', c.slug, '-back.png'), 'v3-sharp'
from catalog_colors c join catalogs ca on ca.id=c.catalog_id and ca.slug='t-shirt'
on duplicate key update base_source=values(base_source), renderer_version=values(renderer_version), active=true;

insert into mockup_templates(public_id, catalog_id, color_id, style, placement, base_source, renderer_version)
select concat('tpl_tshirt_', c.slug, '_women_front'), c.catalog_id, c.id, 'women', 'front', concat('mockup/t-shirt/', c.slug, '-front-women.png'), 'v3-sharp'
from catalog_colors c join catalogs ca on ca.id=c.catalog_id and ca.slug='t-shirt'
where c.slug in ('black','white')
union all
select concat('tpl_tshirt_', c.slug, '_women_left_chest'), c.catalog_id, c.id, 'women', 'left-chest', concat('mockup/t-shirt/', c.slug, '-front-women.png'), 'v3-sharp'
from catalog_colors c join catalogs ca on ca.id=c.catalog_id and ca.slug='t-shirt'
where c.slug in ('black','white')
union all
select concat('tpl_tshirt_', c.slug, '_men_front'), c.catalog_id, c.id, 'men', 'front', concat('mockup/t-shirt/', c.slug, '-front-men.png'), 'v3-sharp'
from catalog_colors c join catalogs ca on ca.id=c.catalog_id and ca.slug='t-shirt'
where c.slug='black'
union all
select concat('tpl_tshirt_', c.slug, '_men_left_chest'), c.catalog_id, c.id, 'men', 'left-chest', concat('mockup/t-shirt/', c.slug, '-front-men.png'), 'v3-sharp'
from catalog_colors c join catalogs ca on ca.id=c.catalog_id and ca.slug='t-shirt'
where c.slug='black'
on duplicate key update base_source=values(base_source), renderer_version=values(renderer_version), active=true;

insert into collections(public_id, slug, title, description, status, indexable, seo_title, seo_description)
values ('col_fatherhood', 'fatherhood-gifts', 'Fatherhood Gifts', 'Original apparel gifts for dads and new fathers.', 'active', true, 'Fatherhood Gifts and Dad Shirts', 'Shop original shirts and gifts for dads, new fathers, and growing families.')
on duplicate key update title=values(title), description=values(description), status=values(status), indexable=values(indexable);

insert ignore into schema_migrations(version) values ('002_seed_catalog');
