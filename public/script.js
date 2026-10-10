

const products = [
  {
    id: 1,
    name: "Ergonomic Mouse",
    category: "Technology",
    price: 799,
    description: "A comfortable mouse designed for everyday computer use.",
    image: "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=400&q=80"
  },
  {
    id: 2,
    name: "Wireless Headphones",
    category: "Technology",
    price: 1499,
    description: "Headphones for listening to music, calls, and spoken content.",
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=400&q=80"
  },
  {
    id: 3,
    name: "Digital Voice Recorder",
    category: "Accessibility",
    price: 1199,
    description: "A sample voice recording device for notes and reminders.",
    image: "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=400&q=80"
  },
  {
    id: 4,
    name: "Reading Lamp",
    category: "Daily Living",
    price: 599,
    description: "A desk lamp for a comfortable reading environment.",
    image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=400&q=80"
  },
  {
    id: 5,
    name: "Smart Watch",
    category: "Wellness",
    price: 1999,
    description: "A wearable device concept for time and daily activity tracking.",
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=400&q=80"
  },
  {
    id: 6,
    name: "Portable Speaker",
    category: "Technology",
    price: 999,
    description: "A compact speaker for listening to audio at home or on the go.",
    image: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=400&q=80"
  },
  {
    id: 7,
    name: "Large-Print Notebook",
    category: "Accessibility",
    price: 249,
    description: "A notebook concept with space for clear, easy-to-read notes.",
    image: "https://images.unsplash.com/photo-1531346878377-a5be20888e57?auto=format&fit=crop&w=400&q=80"
  },
  {
    id: 8,
    name: "Reusable Water Bottle",
    category: "Daily Living",
    price: 399,
    description: "A reusable bottle for everyday hydration.",
    image: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=400&q=80"
  }
];

const productGrid = document.getElementById("productGrid");
const searchInput = document.getElementById("productSearch");
const categoryFilters = document.getElementById("categoryFilters");
const productModal = document.getElementById("productModal");

let selectedCategory = "All";

const formatPrice = (price) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(price);

function renderProducts() {
  if (!productGrid) return;

  const query = searchInput.value.trim().toLowerCase();

  const filteredProducts = products.filter((product) => {
    const matchesCategory =
      selectedCategory === "All" ||
      product.category === selectedCategory;

    const matchesSearch =
      product.name.toLowerCase().includes(query) ||
      product.category.toLowerCase().includes(query) ||
      product.description.toLowerCase().includes(query);

    return matchesCategory && matchesSearch;
  });

  if (filteredProducts.length === 0) {
    productGrid.innerHTML =
      '<p class="empty-message">No products found. Try another search.</p>';
    return;
  }

  productGrid.innerHTML = filteredProducts.map((product) => `
    <article class="product-card">
      <div class="product-image-wrap">
        <img
          class="product-image"
          src="${product.image}"
          alt="${product.name}"
          loading="lazy"
        >
      </div>

      <div class="product-info">
        <span class="product-category">${product.category}</span>
        <h2 class="product-title">${product.name}</h2>
        <p class="product-description">${product.description}</p>

        <div class="product-bottom">
          <span class="product-price">${formatPrice(product.price)}</span>
          <button class="product-button" data-product-id="${product.id}">
            View Details
          </button>
        </div>
      </div>
    </article>
  `).join("");
}

function openProduct(productId) {
  const product = products.find((item) => item.id === productId);
  if (!product || !productModal) return;

  document.getElementById("modalImage").innerHTML = `
    <div class="product-image-wrap">
      <img class="product-image" src="${product.image}" alt="${product.name}">
    </div>
  `;

  document.getElementById("modalCategory").textContent = product.category;
  document.getElementById("modalTitle").textContent = product.name;
  document.getElementById("modalDescription").textContent = product.description;
  document.getElementById("modalPrice").textContent = formatPrice(product.price);

  productModal.classList.add("open");
  document.getElementById("closeModal").focus();
}

if (productGrid) {
  renderProducts();

  productGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-product-id]");
    if (button) openProduct(Number(button.dataset.productId));
  });
}

if (searchInput) {
  searchInput.addEventListener("input", renderProducts);
}

if (categoryFilters) {
  categoryFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;

    selectedCategory = button.dataset.category;

    categoryFilters.querySelectorAll(".category-button").forEach((item) => {
      item.classList.toggle("active", item === button);
    });

    renderProducts();
  });
}

if (productModal) {
  document.getElementById("closeModal").addEventListener("click", () => {
    productModal.classList.remove("open");
  });

  productModal.addEventListener("click", (event) => {
    if (event.target === productModal) {
      productModal.classList.remove("open");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      productModal.classList.remove("open");
    }
  });
}
