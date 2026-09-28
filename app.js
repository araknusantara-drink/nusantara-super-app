const SUPABASE_URL = "https://xevkttwbzfosxmslnrku.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_nqqizWWCx2Wztrdc1ya4XQ_BHaRWM0N";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

let products = [];
let cart = JSON.parse(localStorage.getItem("nusantara_cart") || "[]");

const rupiah = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(n);

function iconForProduct(name) {
  const icons = ["🍾", "🥃", "🍷", "🍸"];

  const index =
    Math.abs(
      [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0)
    ) % icons.length;

  return icons[index];
}

function renderProducts() {
  const container = document.querySelector("#products");

  if (!products.length) {
    container.innerHTML = `
      <div class="card">
        <strong>Belum ada produk aktif.</strong>
        <div>Produk akan muncul setelah tersedia di database.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = products
    .map(
      (p) => `
        <article class="product">
          <div class="product-image">
            ${
              p.image_url
                ? `<img src="${p.image_url}" alt="${p.name}">`
                : iconForProduct(p.name)
            }
          </div>

          <h3>${p.name}</h3>

          <div class="price">
            ${rupiah(Number(p.price))}
          </div>

          <button class="add" onclick="addToCart(${p.id})">
            Tambah
          </button>
        </article>
      `
    )
    .join("");
}

async function loadProducts() {
  const { data, error } = await supabaseClient
    .from("products")
    .select(`
      id,
      name,
      description,
      image_url,
      sku,
      price,
      stock,
      is_active
    `)
    .eq("is_active", true)
    .order("created_at", {
      ascending: true
    });

  if (error) {
    console.error("Gagal mengambil produk:", error);

    document.querySelector("#products").innerHTML = `
      <div class="card">
        <strong>Produk belum bisa dimuat.</strong>
        <div>
          Ada masalah koneksi ke database Supabase.
        </div>
      </div>
    `;

    return;
  }

  products = data || [];

  renderProducts();
}

function addToCart(id) {
  const product = products.find((p) => p.id === id);

  if (!product) return;

  const existing = cart.find((item) => item.id === id);

  if (existing) {
    existing.qty++;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: Number(product.price),
      image_url: product.image_url,
      qty: 1
    });
  }

  localStorage.setItem(
    "nusantara_cart",
    JSON.stringify(cart)
  );

  renderCart();
}

function renderCart() {
  const element = document.querySelector("#cart");

  if (!cart.length) {
    element.textContent = "Keranjang masih kosong.";
    return;
  }

  const total = cart.reduce(
    (sum, item) =>
      sum + item.price * item.qty,
    0
  );

  element.innerHTML =
    cart
      .map(
        (item) =>
          `${item.name} × ${item.qty} — ${rupiah(
            item.price * item.qty
          )}`
      )
      .join("<br>") +
    `<hr><strong>Total: ${rupiah(total)}</strong>`;
}

renderCart();
loadProducts();
