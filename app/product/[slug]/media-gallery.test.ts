import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { selectGalleryImages } from "@/app/product/[slug]/media-gallery";

const images = [
	"/img/design/t-shirt-black-front.webp",
	"/img/design/t-shirt-black-women-front.webp",
	"/img/design/t-shirt-black-men-front.webp",
	"/img/design/t-shirt-black-left-chest.webp",
	"/img/design/t-shirt-black-back.webp",
	"/img/blank/t-shirt-black-front.webp",
	"/img/blank/t-shirt-black-women-front.webp",
	"/img/blank/t-shirt-black-men-front.webp",
	"/img/blank/t-shirt-black-back.webp",
	"/img/design/t-shirt-white-front.webp",
	"/img/design/t-shirt-white-back.webp",
	"/img/blank/t-shirt-white-front.webp",
	"/img/blank/t-shirt-white-back.webp",
];

describe("selectGalleryImages", () => {
	test("front includes printed model views and the original back", () => {
		assert.deepEqual(selectGalleryImages(images, "Black", "front"), [
			images[0],
			images[1],
			images[2],
			images[8],
		]);
	});

	test("back includes original front views and the printed back", () => {
		assert.deepEqual(selectGalleryImages(images, "Black", "back"), [
			images[5],
			images[6],
			images[7],
			images[4],
		]);
	});

	test("front and back includes every printed model view", () => {
		assert.deepEqual(selectGalleryImages(images, "Black", "front-back"), [
			images[0],
			images[1],
			images[2],
			images[4],
		]);
	});

	test("selects only the requested color", () => {
		assert.deepEqual(selectGalleryImages(images, "White", "back"), [images[11], images[10]]);
	});

	test("keeps the flat image first when model style comes from a render URL", () => {
		const renderedImages = [
			"/yorkshire-terrier/sweatshirt_color-black.webp?placement=front&style=men",
			"/yorkshire-terrier/sweatshirt_color-black.webp?placement=front&style=flat",
			"/yorkshire-terrier/sweatshirt_color-black.webp?placement=front&style=women",
		];

		assert.deepEqual(selectGalleryImages(renderedImages, "Black", "front"), [
			renderedImages[1],
			renderedImages[2],
			renderedImages[0],
		]);
	});
});
