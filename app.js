const SUPABASE_URL =
  "https://xevkttwbzfosxmslnrku.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_nqqizWWCx2Wztrdc1ya4XQ_BHaRWM0";

const LIVE_SITE_URL =
  "https://araknusantara-drink.github.io/nusantara-super-app/";

const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );


/* =========================
   DATA
========================= */

let products = [];

let cart = JSON.parse(
  localStorage.getItem("nusantara_cart") || "[]"
);


/* =========================
   FORMAT RUPIAH
========================= */

const rupiah = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(n);


/* =========================
   PRODUCT ICON
========================= */

function iconForProduct(name) {

  const icons = [
    "🍾",
    "🥃",
    "🍷",
    "🍸"
  ];

  const index =
    Math.abs(
      [...name].reduce(
        (sum, char) =>
          sum + char.charCodeAt(0),
        0
      )
    ) % icons.length;

  return icons[index];
}


/* =========================
   RENDER PRODUCTS
========================= */

function renderProducts() {

  const container =
    document.querySelector("#products");

  if (!container) return;

  if (!products.length) {

    container.innerHTML = `
      <div class="card">
        <strong>
          Belum ada produk aktif.
        </strong>

        <div>
          Produk akan muncul setelah tersedia di database.
        </div>
      </div>
    `;

    return;
  }

  container.innerHTML =
    products
      .map(
        (p) => `
          <article class="product">

            <div class="product-image">

              ${
                p.image_url
                  ? `
                    <img
                      src="${p.image_url}"
                      alt="${p.name}"
                    >
                  `
                  : iconForProduct(p.name)
              }

            </div>

            <h3>
              ${p.name}
            </h3>

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


/* =========================
   LOAD PRODUCTS
========================= */

async function loadProducts() {

  const {
    data,
    error
  } =
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

    const container =
      document.querySelector("#products");

    if (container) {

      container.innerHTML = `
        <div class="card">

          <strong>
            Produk belum bisa dimuat.
          </strong>

          <div>
            Ada masalah koneksi ke database Supabase.
          </div>

        </div>
      `;
    }

    return;
  }

  products = data || [];

  renderProducts();
}


/* =========================
   CART
========================= */

function addToCart(id) {

  const product =
    products.find(
      (p) => p.id === id
    );

  if (!product) return;

  const existing =
    cart.find(
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

  if (!element) return;

  if (!cart.length) {

    element.textContent =
      "Keranjang masih kosong.";

    return;
  }

  const total =
    cart.reduce(
      (sum, item) =>
        sum +
        item.price *
        item.qty,
      0
    );

  element.innerHTML =

    cart
      .map(
        (item) => `
          ${item.name}
          × ${item.qty}
          —
          ${rupiah(
            item.price *
            item.qty
          )}
        `
      )
      .join("<br>")

    +

    `
      <hr>

      <strong>
        Total:
        ${rupiah(total)}
      </strong>
    `;
}


/* =========================
   ACCOUNT PANEL
========================= */

function openAccountPanel() {

  const panel =
    document.querySelector(
      "#accountPanel"
    );

  if (!panel) return;

  panel.style.display =
    "block";

  panel.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}


function closeAccountPanel() {

  const panel =
    document.querySelector(
      "#accountPanel"
    );

  if (!panel) return;

  panel.style.display =
    "none";
}


/* =========================
   AUTH VIEW
========================= */

function showLoginView() {

  const login =
    document.querySelector(
      "#loginView"
    );

  const register =
    document.querySelector(
      "#registerView"
    );

  const loggedIn =
    document.querySelector(
      "#loggedInView"
    );

  if (login)
    login.style.display =
      "block";

  if (register)
    register.style.display =
      "none";

  if (loggedIn)
    loggedIn.style.display =
      "none";
}


function showRegisterView() {

  const login =
    document.querySelector(
      "#loginView"
    );

  const register =
    document.querySelector(
      "#registerView"
    );

  const loggedIn =
    document.querySelector(
      "#loggedInView"
    );

  if (login)
    login.style.display =
      "none";

  if (register)
    register.style.display =
      "block";

  if (loggedIn)
    loggedIn.style.display =
      "none";
}


function showLoggedInView(user) {

  const login =
    document.querySelector(
      "#loginView"
    );

  const register =
    document.querySelector(
      "#registerView"
    );

  const loggedIn =
    document.querySelector(
      "#loggedInView"
    );

  if (login)
    login.style.display =
      "none";

  if (register)
    register.style.display =
      "none";

  if (loggedIn)
    loggedIn.style.display =
      "block";


  const email =
    user?.email ||
    "-";


  const name =
    user?.user_metadata?.full_name ||
    "Customer Nusantara";


  const accountName =
    document.querySelector(
      "#accountName"
    );

  const accountEmail =
    document.querySelector(
      "#accountEmail"
    );


  if (accountName) {

    accountName.textContent =
      `Nama: ${name}`;
  }


  if (accountEmail) {

    accountEmail.textContent =
      `Email: ${email}`;
  }
}


/* =========================
   MESSAGE HELPER
========================= */

function setMessage(
  element,
  message
) {

  if (!element) return;

  element.textContent =
    message;
}


/* =========================
   RESEND VERIFICATION
========================= */

async function resendVerification(
  email,
  messageElement
) {

  if (!email) {

    setMessage(
      messageElement,
      "Masukkan email terlebih dahulu."
    );

    return;
  }


  setMessage(
    messageElement,
    "Mengirim ulang email verifikasi..."
  );


  const {
    error
  } =
    await supabaseClient.auth.resend({
      type: "signup",

      email: email,

      options: {
        emailRedirectTo:
          LIVE_SITE_URL
      }
    });


  if (error) {

    console.error(
      "Gagal mengirim ulang:",
      error
    );

    setMessage(
      messageElement,
      `Gagal mengirim email: ${error.message}`
    );

    return;
  }


  setMessage(
    messageElement,
    "Email verifikasi baru sudah dikirim. Silakan cek inbox atau folder spam."
  );
}


/* =========================
   RESEND BUTTON
========================= */

function showResendButton(
  email,
  messageElement
) {

  if (!messageElement) return;


  const oldButton =
    document.querySelector(
      ".resend-verification-button"
    );

  if (oldButton)
    oldButton.remove();


  const button =
    document.createElement(
      "button"
    );


  button.type =
    "button";

  button.className =
    "text-btn resend-verification-button";

  button.textContent =
    "Kirim ulang email verifikasi";


  button.style.display =
    "block";

  button.style.marginTop =
    "10px";


  button.addEventListener(
    "click",
    () =>
      resendVerification(
        email,
        messageElement
      )
  );


  messageElement.insertAdjacentElement(
    "afterend",
    button
  );
}


/* =========================
   REGISTER
========================= */

async function handleRegister(
  event
) {

  event.preventDefault();


  const name =
    document
      .querySelector(
        "#registerName"
      )
      .value
      .trim();


  const email =
    document
      .querySelector(
        "#registerEmail"
      )
      .value
      .trim();


  const password =
    document
      .querySelector(
        "#registerPassword"
      )
      .value;


  const message =
    document.querySelector(
      "#registerMessage"
    );


  setMessage(
    message,
    "Membuat akun..."
  );


  const {
    data,
    error
  } =
    await supabaseClient.auth.signUp({

      email,

      password,

      options: {

        emailRedirectTo:
          LIVE_SITE_URL,

        data: {

          full_name:
            name

        }
      }
    });


  if (error) {

    console.error(
      "Register error:",
      error
    );

    setMessage(
      message,
      `Gagal membuat akun: ${error.message}`
    );

    return;
  }


  document
    .querySelector(
      "#registerForm"
    )
    .reset();


  if (data.session) {

    setMessage(
      message,
      "Akun berhasil dibuat dan langsung aktif."
    );

    showLoggedInView(
      data.user
    );

    return;
  }


  setMessage(
    message,
    "Akun berhasil dibuat. Silakan cek email untuk verifikasi."
  );


  showResendButton(
    email,
    message
  );
}


/* =========================
   LOGIN
========================= */

async function handleLogin(
  event
) {

  event.preventDefault();


  const email =
    document
      .querySelector(
        "#loginEmail"
      )
      .value
      .trim();


  const password =
    document
      .querySelector(
        "#loginPassword"
      )
      .value;


  const message =
    document.querySelector(
      "#loginMessage"
    );


  setMessage(
    message,
    "Memeriksa akun..."
  );


  const {
    data,
    error
  } =
    await supabaseClient.auth.signInWithPassword({

      email,

      password

    });


  if (error) {

    console.error(
      "Login error:",
      error
    );


    setMessage(
      message,
      `Login gagal: ${error.message}`
    );


    if (
      error.message
        .toLowerCase()
        .includes("email not confirmed")
    ) {

      showResendButton(
        email,
        message
      );
    }


    return;
  }


  setMessage(
    message,
    "Login berhasil."
  );


  document
    .querySelector(
      "#loginForm"
    )
    .reset();


  showLoggedInView(
    data.user
  );
}


/* =========================
   LOGOUT
========================= */

async function handleLogout() {

  const {
    error
  } =
    await supabaseClient.auth.signOut();


  if (error) {

    console.error(
      "Logout error:",
      error
    );

    alert(
      `Gagal keluar: ${error.message}`
    );

    return;
  }


  showLoginView();

  closeAccountPanel();
}


/* =========================
   SESSION
========================= */

async function checkSession() {

  const {
    data: {
      session
    }
  } =
    await supabaseClient.auth.getSession();


  if (
    session?.user
  ) {

    showLoggedInView(
      session.user
    );
  }
}


/* =========================
   NAVIGATION
========================= */

function setupNavigation() {

  const accountButton =
    document.querySelector(
      "#accountButton"
    );


  const viewAllButton =
    document.querySelector(
      "#viewAllButton"
    );


  const homeNavButton =
    document.querySelector(
      "#homeNavButton"
    );


  const ordersNavButton =
    document.querySelector(
      "#ordersNavButton"
    );


  const profileNavButton =
    document.querySelector(
      "#profileNavButton"
    );


  if (accountButton) {

    accountButton.addEventListener(
      "click",
      async () => {

        openAccountPanel();

        const {
          data: {
            session
          }
        } =
          await supabaseClient.auth.getSession();


        if (
          session?.user
        ) {

          showLoggedInView(
            session.user
          );

        } else {

          showLoginView();
        }
      }
    );
  }


  if (viewAllButton) {

    viewAllButton.addEventListener(
      "click",
      () => {

        const productsSection =
          document.querySelector(
            "#products"
          );

        if (
          productsSection
        ) {

          productsSection.scrollIntoView({
            behavior: "smooth"
          });
        }
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
          data: {
            session
          }
        } =
          await supabaseClient.auth.getSession();


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
          data: {
            session
          }
        } =
          await supabaseClient.auth.getSession();


        if (!session) {

          openAccountPanel();

          showLoginView();

          return;
        }


        openAccountPanel();

        showLoggedInView(
          session.user
        );
      }
    );
  }
}


/* =========================
   AUTH FORMS
========================= */

function setupAuthForms() {

  const loginForm =
    document.querySelector(
      "#loginForm"
    );


  const registerForm =
    document.querySelector(
      "#registerForm"
    );


  const logoutButton =
    document.querySelector(
      "#logoutButton"
    );


  const showRegisterButton =
    document.querySelector(
      "#showRegisterButton"
    );


  const showLoginButton =
    document.querySelector(
      "#showLoginButton"
    );


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
   AUTH STATE CHANGE
========================= */

supabaseClient.auth.onAuthStateChange(
  (
    event,
    session
  ) => {

    console.log(
      "Auth event:",
      event
    );


    if (
      session?.user
    ) {

      showLoggedInView(
        session.user
      );
    }
  }
);


/* =========================
   START APPLICATION
========================= */

renderCart();

setupNavigation();

setupAuthForms();

checkSession();

loadProducts();
