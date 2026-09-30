const SUPABASE_URL =
  "https://xevkttwbzfosxmslnrku.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhldmt0d2J6Zm9zeG1zbG5ya3UiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc5MDQwNTkzNywiZXhwIjoyMTA1OTgxOTM3fQ.KI-1LcZ0mJIFbUHH6Br9LKphHns13mREGzpK9rOtzCc";

const LIVE_SITE_URL =
  "https://araknusantara-drink.github.io/nusantara-super-app/";

const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );

let products = [];

let cart = JSON.parse(
  localStorage.getItem("nusantara_cart") || "[]"
);

let currentUser = null;
let customerAddresses = [];
let editingAddressId = null;


/* =========================
   FORMAT
========================= */

const rupiah = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(n) || 0);


/* =========================
   SECURITY
========================= */

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


/* =========================
   PRODUCT ICON
========================= */

function iconForProduct(name) {
  const icons = ["🍾", "🥃", "🍷", "🍸"];

  const index =
    Math.abs(
      [...String(name || "")]
        .reduce(
          (sum, char) =>
            sum + char.charCodeAt(0),
          0
        )
    ) % icons.length;

  return icons[index];
}


/* =========================
   PRODUCTS
========================= */

function renderProducts() {

  const container =
    document.querySelector("#products");

  if (!container) return;

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

  container.innerHTML =
    products.map((p) => {

      const image = p.image_url
        ? `
          <img
            src="${escapeHtml(p.image_url)}"
            alt="${escapeHtml(p.name)}"
          >
        `
        : iconForProduct(p.name);

      return `
        <article class="product">

          <div class="product-image">
            ${image}
          </div>

          <h3>
            ${escapeHtml(p.name)}
          </h3>

          <div class="price">
            ${rupiah(p.price)}
          </div>

          <button
            class="add"
            onclick="addToCart(${Number(p.id)})"
          >
            Tambah
          </button>

        </article>
      `;

    }).join("");
}


async function loadProducts() {

  const container =
    document.querySelector("#products");

  if (!container) return;

  container.innerHTML = `
    <div class="card">
      <strong>Memuat produk...</strong>
      <div>Menghubungkan ke database.</div>
    </div>
  `;

  try {

    const result =
      await supabaseClient
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("id", {
          ascending: true
        });

    const {
      data,
      error
    } = result;

    console.log(
      "SUPABASE PRODUCT RESULT:",
      result
    );

    if (error) {

      console.error(
        "SUPABASE PRODUCT ERROR:",
        error
      );

      container.innerHTML = `
        <div class="card">

          <strong>
            Produk belum bisa dimuat.
          </strong>

          <div style="margin-top:10px;">
            Koneksi ke database gagal.
          </div>

          <div style="
            margin-top:12px;
            padding:10px;
            background:#f1f1f1;
            border-radius:8px;
            font-size:13px;
            word-break:break-word;
          ">
            <strong>Detail error:</strong><br>
            ${escapeHtml(error.message || "Tidak ada pesan error")}<br><br>

            <strong>Code:</strong>
            ${escapeHtml(error.code || "-")}
          </div>

        </div>
      `;

      return;
    }

    products = data || [];

    console.log(
      "JUMLAH PRODUK:",
      products.length
    );

    renderProducts();

  } catch (err) {

    console.error(
      "PRODUCT FETCH EXCEPTION:",
      err
    );

    container.innerHTML = `
      <div class="card">

        <strong>
          Produk belum bisa dimuat.
        </strong>

        <div style="margin-top:10px;">
          Terjadi error saat menghubungkan website
          ke Supabase.
        </div>

        <div style="
          margin-top:12px;
          padding:10px;
          background:#f1f1f1;
          border-radius:8px;
          font-size:13px;
          word-break:break-word;
        ">
          ${escapeHtml(err.message || err)}
        </div>

      </div>
    `;
  }
}


/* =========================
   CART
========================= */

function addToCart(id) {

  const product =
    products.find(
      (p) => Number(p.id) === Number(id)
    );

  if (!product) return;

  const existing =
    cart.find(
      (item) =>
        Number(item.id) === Number(id)
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
        Number(item.price) *
        Number(item.qty),
      0
    );

  element.innerHTML =
    cart.map(
      (item) => `
        ${escapeHtml(item.name)}
        × ${Number(item.qty)}
        —
        ${rupiah(
          Number(item.price) *
          Number(item.qty)
        )}
      `
    ).join("<br>") +
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

  panel.style.display = "block";

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

  panel.style.display = "none";
}


/* =========================
   AUTH VIEW
========================= */

function showLoginView() {

  document.querySelector("#loginView")
    ?.style.setProperty("display", "block");

  document.querySelector("#registerView")
    ?.style.setProperty("display", "none");

  document.querySelector("#loggedInView")
    ?.style.setProperty("display", "none");
}


function showRegisterView() {

  document.querySelector("#loginView")
    ?.style.setProperty("display", "none");

  document.querySelector("#registerView")
    ?.style.setProperty("display", "block");

  document.querySelector("#loggedInView")
    ?.style.setProperty("display", "none");
}


async function showLoggedInView(user) {

  currentUser = user;

  document.querySelector("#loginView")
    ?.style.setProperty("display", "none");

  document.querySelector("#registerView")
    ?.style.setProperty("display", "none");

  document.querySelector("#loggedInView")
    ?.style.setProperty("display", "block");

  const email =
    user?.email || "-";

  const name =
    user?.user_metadata?.full_name ||
    "Customer Nusantara";

  const accountName =
    document.querySelector("#accountName");

  const accountEmail =
    document.querySelector("#accountEmail");

  if (accountName) {
    accountName.textContent =
      `Nama: ${name}`;
  }

  if (accountEmail) {
    accountEmail.textContent =
      `Email: ${email}`;
  }

  await loadCustomerProfile(user);

  await loadAddresses();
}


/* =========================
   MESSAGE
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
      email,
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
    document.createElement("button");

  button.type = "button";

  button.className =
    "text-btn resend-verification-button";

  button.textContent =
    "Kirim ulang email verifikasi";

  button.style.display = "block";
  button.style.marginTop = "10px";

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

async function handleRegister(event) {

  event.preventDefault();

  const name =
    document
      .querySelector("#registerName")
      .value
      .trim();

  const email =
    document
      .querySelector("#registerEmail")
      .value
      .trim();

  const password =
    document
      .querySelector("#registerPassword")
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
          full_name: name
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
    .querySelector("#registerForm")
    .reset();

  if (data.session) {

    setMessage(
      message,
      "Akun berhasil dibuat dan langsung aktif."
    );

    await showLoggedInView(
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

async function handleLogin(event) {

  event.preventDefault();

  const email =
    document
      .querySelector("#loginEmail")
      .value
      .trim();

  const password =
    document
      .querySelector("#loginPassword")
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
    .querySelector("#loginForm")
    .reset();

  await showLoggedInView(
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

  currentUser = null;
  customerAddresses = [];
  editingAddressId = null;

  showLoginView();

  closeAccountPanel();
}


/* =========================
   CUSTOMER PROFILE
========================= */

async function loadCustomerProfile(user) {

  if (!user) return;

  const {
    data,
    error
  } =
    await supabaseClient
      .from("profiles")
      .select(
        "id, full_name, phone, role, avatar_url, is_active"
      )
      .eq("id", user.id)
      .maybeSingle();

  if (error) {

    console.error(
      "Profile load error:",
      error
    );

    return;
  }

  const fullName =
    data?.full_name ||
    user.user_metadata?.full_name ||
    "";

  const phone =
    data?.phone || "";

  const profileFullName =
    document.querySelector(
      "#profileFullName"
    );

  const profilePhone =
    document.querySelector(
      "#profilePhone"
    );

  if (profileFullName) {
    profileFullName.value =
      fullName;
  }

  if (profilePhone) {
    profilePhone.value =
      phone;
  }

  const accountName =
    document.querySelector(
      "#accountName"
    );

  if (accountName) {

    accountName.textContent =
      `Nama: ${fullName || "Customer Nusantara"}`;
  }
}


async function handleProfileSave(event) {

  event.preventDefault();

  if (!currentUser) return;

  const fullName =
    document
      .querySelector("#profileFullName")
      .value
      .trim();

  const phone =
    document
      .querySelector("#profilePhone")
      .value
      .trim();

  const message =
    document.querySelector(
      "#profileMessage"
    );

  if (!fullName) {

    setMessage(
      message,
      "Nama lengkap wajib diisi."
    );

    return;
  }

  setMessage(
    message,
    "Menyimpan profil..."
  );

  const {
    error
  } =
    await supabaseClient
      .from("profiles")
      .update({
        full_name: fullName,
        phone: phone || null
      })
      .eq("id", currentUser.id);

  if (error) {

    console.error(
      "Profile update error:",
      error
    );

    setMessage(
      message,
      `Gagal menyimpan profil: ${error.message}`
    );

    return;
  }

  setMessage(
    message,
    "Profil berhasil disimpan."
  );

  const accountName =
    document.querySelector(
      "#accountName"
    );

  if (accountName) {

    accountName.textContent =
      `Nama: ${fullName}`;
  }
}


/* =========================
   ADDRESSES
========================= */

async function loadAddresses() {

  if (!currentUser) return;

  const {
    data,
    error
  } =
    await supabaseClient
      .from("addresses")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("is_default", {
        ascending: false
      })
      .order("id", {
        ascending: false
      });

  if (error) {

    console.error(
      "Address load error:",
      error
    );

    setMessage(
      document.querySelector(
        "#addressMessage"
      ),
      `Gagal memuat alamat: ${error.message}`
    );

    return;
  }

  customerAddresses =
    data || [];

  renderAddresses();
}


function renderAddresses() {

  const container =
    document.querySelector(
      "#addressList"
    );

  if (!container) return;

  if (!customerAddresses.length) {

    container.innerHTML =
      `<p>Belum ada alamat tersimpan.</p>`;

    return;
  }

  container.innerHTML =
    customerAddresses.map(
      (address) => `
        <div
          class="card"
          style="margin:10px 0;"
        >

          <strong>
            ${escapeHtml(address.label)}
          </strong>

          ${
            address.is_default
              ? `<span> ⭐ Alamat utama</span>`
              : ""
          }

          <p>
            ${escapeHtml(address.recipient_name)}
            ·
            ${escapeHtml(address.phone)}
          </p>

          <p>
            ${escapeHtml(address.address_line)}
          </p>

          <p>
            ${escapeHtml(address.city)},
            ${escapeHtml(address.province)}
            ${address.postal_code
              ? ` ${escapeHtml(address.postal_code)}`
              : ""}
          </p>

          ${
            address.notes
              ? `
                <p>
                  Catatan:
                  ${escapeHtml(address.notes)}
                </p>
              `
              : ""
          }

          <button
            type="button"
            class="text-btn"
            onclick="editAddress(${Number(address.id)})"
          >
            Edit
          </button>

          <button
            type="button"
            class="text-btn"
            onclick="makeDefaultAddress(${Number(address.id)})"
            ${
              address.is_default
                ? "disabled"
                : ""
            }
          >
            Jadikan utama
          </button>

          <button
            type="button"
            class="text-btn"
            onclick="deleteAddress(${Number(address.id)})"
          >
            Hapus
          </button>

        </div>
      `
    ).join("");
}


function resetAddressForm() {

  editingAddressId = null;

  const form =
    document.querySelector(
      "#addressForm"
    );

  if (form) {
    form.reset();
  }

  const label =
    document.querySelector(
      "#addressLabel"
    );

  if (label) {
    label.value = "Rumah";
  }

  const title =
    document.querySelector(
      "#addressFormTitle"
    );

  if (title) {
    title.textContent =
      "Tambah alamat";
  }

  const cancelButton =
    document.querySelector(
      "#cancelAddressButton"
    );

  if (cancelButton) {
    cancelButton.style.display =
      "none";
  }

  setMessage(
    document.querySelector(
      "#addressMessage"
    ),
    ""
  );
}


function editAddress(id) {

  const address =
    customerAddresses.find(
      (item) =>
        Number(item.id) === Number(id)
    );

  if (!address) return;

  editingAddressId =
    address.id;

  document.querySelector(
    "#addressLabel"
  ).value =
    address.label || "Rumah";

  document.querySelector(
    "#addressRecipient"
  ).value =
    address.recipient_name || "";

  document.querySelector(
    "#addressPhone"
  ).value =
    address.phone || "";

  document.querySelector(
    "#addressLine"
  ).value =
    address.address_line || "";

  document.querySelector(
    "#addressCity"
  ).value =
    address.city || "";

  document.querySelector(
    "#addressProvince"
  ).value =
    address.province || "";

  document.querySelector(
    "#addressPostalCode"
  ).value =
    address.postal_code || "";

  document.querySelector(
    "#addressNotes"
  ).value =
    address.notes || "";

  document.querySelector(
    "#addressDefault"
  ).checked =
    Boolean(address.is_default);

  const title =
    document.querySelector(
      "#addressFormTitle"
    );

  if (title) {
    title.textContent =
      "Edit alamat";
  }

  const cancelButton =
    document.querySelector(
      "#cancelAddressButton"
    );

  if (cancelButton) {
    cancelButton.style.display =
      "block";
  }

  document.querySelector(
    "#addressForm"
  )?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}


async function handleAddressSave(event) {

  event.preventDefault();

  if (!currentUser) return;

  const message =
    document.querySelector(
      "#addressMessage"
    );

  const addressData = {

    user_id:
      currentUser.id,

    label:
      document
        .querySelector("#addressLabel")
        .value
        .trim(),

    recipient_name:
      document
        .querySelector("#addressRecipient")
        .value
        .trim(),

    phone:
      document
        .querySelector("#addressPhone")
        .value
        .trim(),

    address_line:
      document
        .querySelector("#addressLine")
        .value
        .trim(),

    city:
      document
        .querySelector("#addressCity")
        .value
        .trim(),

    province:
      document
        .querySelector("#addressProvince")
        .value
        .trim(),

    postal_code:
      document
        .querySelector("#addressPostalCode")
        .value
        .trim() || null,

    notes:
      document
        .querySelector("#addressNotes")
        .value
        .trim() || null,

    is_default:
      document.querySelector(
        "#addressDefault"
      ).checked
  };

  if (
    !addressData.label ||
    !addressData.recipient_name ||
    !addressData.phone ||
    !addressData.address_line ||
    !addressData.city ||
    !addressData.province
  ) {

    setMessage(
      message,
      "Lengkapi data alamat terlebih dahulu."
    );

    return;
  }

  setMessage(
    message,
    "Menyimpan alamat..."
  );


  /*
    Kalau dijadikan alamat utama,
    alamat utama lama dibuat nonaktif
    terlebih dahulu.
  */

  if (addressData.is_default) {

    const {
      error
    } =
      await supabaseClient
        .from("addresses")
        .update({
          is_default: false
        })
        .eq(
          "user_id",
          currentUser.id
        );

    if (error) {

      console.error(
        "Default address reset error:",
        error
      );

      setMessage(
        message,
        `Gagal mengatur alamat utama: ${error.message}`
      );

      return;
    }
  }


  let result;

  if (editingAddressId) {

    result =
      await supabaseClient
        .from("addresses")
        .update(addressData)
        .eq(
          "id",
          editingAddressId
        )
        .eq(
          "user_id",
          currentUser.id
        );

  } else {

    result =
      await supabaseClient
        .from("addresses")
        .insert(addressData);
  }


  if (result.error) {

    console.error(
      "Address save error:",
      result.error
    );

    setMessage(
      message,
      `Gagal menyimpan alamat: ${result.error.message}`
    );

    return;
  }

  setMessage(
    message,
    "Alamat berhasil disimpan."
  );

  resetAddressForm();

  await loadAddresses();
}


async function deleteAddress(id) {

  if (!currentUser) return;

  const address =
    customerAddresses.find(
      (item) =>
        Number(item.id) === Number(id)
    );

  if (!address) return;

  const confirmed =
    window.confirm(
      `Hapus alamat "${address.label}"?`
    );

  if (!confirmed) return;

  const {
    error
  } =
    await supabaseClient
      .from("addresses")
      .delete()
      .eq(
        "id",
        id
      )
      .eq(
        "user_id",
        currentUser.id
      );

  if (error) {

    console.error(
      "Delete address error:",
      error
    );

    alert(
      `Gagal menghapus alamat: ${error.message}`
    );

    return;
  }

  await loadAddresses();
}


async function makeDefaultAddress(id) {

  if (!currentUser) return;

  const {
    error: resetError
  } =
    await supabaseClient
      .from("addresses")
      .update({
        is_default: false
      })
      .eq(
        "user_id",
        currentUser.id
      );

  if (resetError) {

    alert(
      `Gagal mengatur alamat: ${resetError.message}`
    );

    return;
  }

  const {
    error
  } =
    await supabaseClient
      .from("addresses")
      .update({
        is_default: true
      })
      .eq(
        "id",
        id
      )
      .eq(
        "user_id",
        currentUser.id
      );

  if (error) {

    alert(
      `Gagal menjadikan alamat utama: ${error.message}`
    );

    return;
  }

  await loadAddresses();
}


/* =========================
   CUSTOMER FORMS
========================= */

function setupCustomerForms() {

  const profileForm =
    document.querySelector(
      "#profileForm"
    );

  const addressForm =
    document.querySelector(
      "#addressForm"
    );

  const cancelAddressButton =
    document.querySelector(
      "#cancelAddressButton"
    );

  if (profileForm) {

    profileForm.addEventListener(
      "submit",
      handleProfileSave
    );
  }

  if (addressForm) {

    addressForm.addEventListener(
      "submit",
      handleAddressSave
    );
  }

  if (cancelAddressButton) {

    cancelAddressButton.addEventListener(
      "click",
      resetAddressForm
    );
  }
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

  if (session?.user) {

    await showLoggedInView(
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

        if (session?.user) {

          await showLoggedInView(
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

        productsSection?.scrollIntoView({
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

        await showLoggedInView(
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
   AUTH STATE
========================= */

supabaseClient.auth.onAuthStateChange(
  async (
    event,
    session
  ) => {

    console.log(
      "Auth event:",
      event
    );

    if (session?.user) {

      await showLoggedInView(
        session.user
      );

    } else if (
      event === "SIGNED_OUT"
    ) {

      currentUser = null;
      customerAddresses = [];
      editingAddressId = null;

      showLoginView();
    }
  }
);


/* =========================
   START
========================= */

renderCart();

setupNavigation();

setupAuthForms();

setupCustomerForms();

checkSession();

loadProducts();
