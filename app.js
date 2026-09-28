const SUPABASE_URL = "https://xevkttwbzfosxmslnrku.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_nqqizWWCx2Wztrdc1ya4XQ_BHaRWM0N";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

let products = [];
let cart = JSON.parse(
  localStorage.getItem("nusantara_cart") || "[]"
);

const rupiah = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(n);


/* =========================
   PRODUK
========================= */

function iconForProduct(name) {
  const icons = ["🍾", "🥃", "🍷", "🍸"];

  const index =
    Math.abs(
      [...name].reduce(
        (sum, char) => sum + char.charCodeAt(0),
        0
      )
    ) % icons.length;

  return icons[index];
}


function renderProducts() {
  const container =
    document.querySelector("#products");

  if (!products.length) {
    container.innerHTML = `
      <div class="card">
        <strong>Belum ada produk aktif.</strong>
        <div>
          Produk akan muncul setelah tersedia di database.
        </div>
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

          <button
            class="add"
            onclick="addToCart(${p.id})"
          >
            Tambah
          </button>

        </article>
      `
    )
    .join("");
}


async function loadProducts() {
  const { data, error } =
    await supabaseClient
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
    console.error(
      "Gagal mengambil produk:",
      error
    );

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


/* =========================
   KERANJANG
========================= */

function addToCart(id) {
  const product = products.find(
    (p) => p.id === id
  );

  if (!product) return;

  const existing = cart.find(
    (item) => item.id === id
  );

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
  const element =
    document.querySelector("#cart");

  if (!cart.length) {
    element.textContent =
      "Keranjang masih kosong.";

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


/* =========================
   ACCOUNT PANEL
========================= */

function openAccountPanel() {
  const panel =
    document.querySelector("#accountPanel");

  if (!panel) return;

  panel.style.display = "block";

  panel.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}


function closeAccountPanel() {
  const panel =
    document.querySelector("#accountPanel");

  if (!panel) return;

  panel.style.display = "none";
}


function showLoginView() {
  document.querySelector("#loginView").style.display =
    "block";

  document.querySelector("#registerView").style.display =
    "none";

  document.querySelector("#loggedInView").style.display =
    "none";
}


function showRegisterView() {
  document.querySelector("#loginView").style.display =
    "none";

  document.querySelector("#registerView").style.display =
    "block";

  document.querySelector("#loggedInView").style.display =
    "none";
}


function showLoggedInView(user) {
  document.querySelector("#loginView").style.display =
    "none";

  document.querySelector("#registerView").style.display =
    "none";

  document.querySelector("#loggedInView").style.display =
    "block";

  const email =
    user?.email || "-";

  const name =
    user?.user_metadata?.full_name ||
    "Customer Nusantara";

  document.querySelector("#accountName").textContent =
    `Nama: ${name}`;

  document.querySelector("#accountEmail").textContent =
    `Email: ${email}`;
}


/* =========================
   REGISTER
========================= */

async function handleRegister(event) {
  event.preventDefault();

  const name =
    document.querySelector("#registerName").value.trim();

  const email =
    document.querySelector("#registerEmail").value.trim();

  const password =
    document.querySelector("#registerPassword").value;

  const message =
    document.querySelector("#registerMessage");

  message.textContent =
    "Membuat akun...";

  const { data, error } =
    await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name
        }
      }
    });

  if (error) {
    console.error(error);

    message.textContent =
      `Gagal membuat akun: ${error.message}`;

    return;
  }

  if (data.session) {
    message.textContent =
      "Akun berhasil dibuat.";

    showLoggedInView(data.user);

    document.querySelector("#registerForm").reset();

    return;
  }

  message.textContent =
    "Akun berhasil dibuat. Silakan cek email untuk verifikasi akun.";

  document.querySelector("#registerForm").reset();
}


/* =========================
   LOGIN
========================= */

async function handleLogin(event) {
  event.preventDefault();

  const email =
    document.querySelector("#loginEmail").value.trim();

  const password =
    document.querySelector("#loginPassword").value;

  const message =
    document.querySelector("#loginMessage");

  message.textContent =
    "Memeriksa akun...";

  const { data, error } =
    await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

  if (error) {
    console.error(error);

    message.textContent =
      `Login gagal: ${error.message}`;

    return;
  }

  message.textContent =
    "Login berhasil.";

  document.querySelector("#loginForm").reset();

  showLoggedInView(data.user);
}


/* =========================
   LOGOUT
========================= */

async function handleLogout() {
  const { error } =
    await supabaseClient.auth.signOut();

  if (error) {
    console.error(error);

    alert(
      `Gagal keluar: ${error.message}`
    );

    return;
  }

  showLoginView();

  document.querySelector("#accountPanel").style.display =
    "none";
}


/* =========================
   CEK SESSION
========================= */

async function checkSession() {
  const {
    data: { session }
  } = await supabaseClient.auth.getSession();

  if (session?.user) {
    showLoggedInView(session.user);
  }
}


/* =========================
   NAVIGASI
========================= */

function setupNavigation() {

  const accountButton =
    document.querySelector("#accountButton");

  const viewAllButton =
    document.querySelector("#viewAllButton");

  const homeNavButton =
    document.querySelector("#homeNavButton");

  const ordersNavButton =
    document.querySelector("#ordersNavButton");

  const profileNavButton =
    document.querySelector("#profileNavButton");


  if (accountButton) {
    accountButton.addEventListener(
      "click",
      openAccountPanel
    );
  }


  if (viewAllButton) {
    viewAllButton.addEventListener(
      "click",
      () => {
        document
          .querySelector("#products")
          .scrollIntoView({
            behavior: "smooth"
          });
      }
    );
  }


  if (homeNavButton) {
    homeNavButton.addEventListener(
      "click",
      () => {
        window.scrollTo({
          top: 0,
          behavior: "smooth"
        });
      }
    );
  }


  if (ordersNavButton) {
    ordersNavButton.addEventListener(
      "click",
      async () => {

        const {
          data: { session }
        } = await supabaseClient.auth.getSession();

        if (!session) {
          openAccountPanel();
          showLoginView();
          return;
        }

        alert(
          "Halaman pesanan akan kita bangun berikutnya."
        );
      }
    );
  }


  if (profileNavButton) {
    profileNavButton.addEventListener(
      "click",
      async () => {

        const {
          data: { session }
        } = await supabaseClient.auth.getSession();

        if (!session) {
          openAccountPanel();
          showLoginView();
          return;
        }

        openAccountPanel();
        showLoggedInView(session.user);
      }
    );
  }
}


/* =========================
   FORM EVENT
========================= */

function setupAuthForms() {

  const loginForm =
    document.querySelector("#loginForm");

  const registerForm =
    document.querySelector("#registerForm");

  const logoutButton =
    document.querySelector("#logoutButton");

  const showRegisterButton =
    document.querySelector("#showRegisterButton");

  const showLoginButton =
    document.querySelector("#showLoginButton");


  if (loginForm) {
    loginForm.addEventListener(
      "submit",
      handleLogin
    );
  }


  if (registerForm) {
    registerForm.addEventListener(
      "submit",
      handleRegister
    );
  }


  if (logoutButton) {
    logoutButton.addEventListener(
      "click",
      handleLogout
    );
  }


  if (showRegisterButton) {
    showRegisterButton.addEventListener(
      "click",
      showRegisterView
    );
  }


  if (showLoginButton) {
    showLoginButton.addEventListener(
      "click",
      showLoginView
    );
  }
}


/* =========================
   AUTH STATE
========================= */

supabaseClient.auth.onAuthStateChange(
  (event, session) => {

    if (session?.user) {
      showLoggedInView(session.user);
    }

  }
);


/* =========================
   START
========================= */

renderCart();

setupNavigation();

setupAuthForms();

checkSession();

loadProducts();
