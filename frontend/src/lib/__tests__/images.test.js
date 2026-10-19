import {
  cloudinaryUrl,
  MAX_IMAGE_BYTES,
  MAX_POST_IMAGES,
  POST_IMAGE_TRANSFORM,
  validateImageBatch,
  validateImageFile,
} from "../images";

function file(name, type, size) {
  return { name, type, size };
}

describe("validateImageFile", () => {
  it("accepts the four documented types", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/gif"]) {
      expect(validateImageFile(file("a", type, 1024))).toBe("");
    }
  });

  it("refuses anything that is not an image", () => {
    expect(validateImageFile(file("notes.txt", "text/plain", 10))).toBe(
      "Use a JPEG, PNG, WebP or GIF image."
    );
  });

  it("refuses anything over 5 MB", () => {
    expect(validateImageFile(file("big.jpg", "image/jpeg", MAX_IMAGE_BYTES + 1))).toBe(
      "Images must be 5 MB or smaller."
    );
    expect(validateImageFile(file("ok.jpg", "image/jpeg", MAX_IMAGE_BYTES))).toBe("");
  });

  it("asks for a file when nothing was chosen", () => {
    expect(validateImageFile(null)).toBe("Choose an image.");
  });
});

describe("validateImageBatch", () => {
  const jpeg = () => file("a.jpg", "image/jpeg", 1024);

  it("allows up to four images", () => {
    expect(validateImageBatch([jpeg(), jpeg(), jpeg(), jpeg()])).toBe("");
    expect(validateImageBatch([jpeg(), jpeg()], 2)).toBe("");
  });

  it("counts the images already selected", () => {
    expect(validateImageBatch([jpeg(), jpeg()], 3)).toBe(`Up to ${MAX_POST_IMAGES} images per post.`);
  });

  it("reports the first bad file in the batch", () => {
    expect(validateImageBatch([jpeg(), file("b.txt", "text/plain", 10)])).toBe(
      "Use a JPEG, PNG, WebP or GIF image."
    );
  });

  it("treats no selection as fine", () => {
    expect(validateImageBatch(null)).toBe("");
  });
});

describe("cloudinaryUrl", () => {
  it("inserts the delivery transform into a Cloudinary URL", () => {
    const url = "https://res.cloudinary.com/demo/image/upload/murmur/posts/a.jpg";
    expect(cloudinaryUrl(url)).toBe(
      `https://res.cloudinary.com/demo/image/upload/${POST_IMAGE_TRANSFORM}/murmur/posts/a.jpg`
    );
  });

  it("never transforms an asset twice", () => {
    const original = "https://res.cloudinary.com/demo/image/upload/v1/a.jpg";
    const once = cloudinaryUrl(original);

    expect(once).toContain(POST_IMAGE_TRANSFORM);
    expect(cloudinaryUrl(once)).toBe(once);
  });

  it("leaves other URLs alone", () => {
    expect(cloudinaryUrl("blob:http://localhost/abc")).toBe("blob:http://localhost/abc");
    expect(cloudinaryUrl("")).toBe("");
    expect(cloudinaryUrl(undefined)).toBe("");
  });
});
