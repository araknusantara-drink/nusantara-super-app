const SUPABASE_URL =
  "https://xevkttwbzfosxmslnrku.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_nqqizWWCx2Wztrdc1ya4XQ_BHaRWM0N";

const LIVE_SITE_URL =
  "https://araknusantara-drink.github.io/nusantara-super-app/";

const SUPABASE_FUNCTION_URL =
  SUPABASE_URL + "/functions/v1";

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
let orderMapInstances = {};
let orderMapChannels = {};
let paymentRealtimeChannel = null;
let editingAddressId = null;
let wishlistProductIds = new Set();
let notificationRealtimeChannel = null;


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
   WISHLIST
========================= */

async function loadWishlist() {
  wishlistProductIds = new Set();

  if (!currentUser) {
    renderWishlist();
    return;
  }

  const { data, error } = await supabaseClient
    .from("wishlists")
    .select("product_id")
    .eq("user_id", currentUser.id);

  if (error) {
    console.error("Wishlist load error:", error);
    renderWishlist(error.message);
    return;
  }

  (data || []).forEach(item => {
    wishlistProductIds.add(Number(item.product_id));
  });

  renderProducts();
  renderWishlist();
}

function renderWishlist(errorMessage = "") {
  const container = document.querySelector("#wishlistSection");
  if (!container) return;

  if (!currentUser) {
    container.innerHTML = "Login untuk melihat produk favorit.";
    return;
  }

  if (errorMessage) {
    container.innerHTML = "<p>Gagal memuat favorit: " + escapeHtml(errorMessage) + "</p>";
    return;
  }

  const favoriteProducts = products.filter(p => wishlistProductIds.has(Number(p.id)));

  if (!favoriteProducts.length) {
    container.innerHTML = "<p>Belum ada produk favorit.</p>";
    return;
  }

  container.innerHTML = favoriteProducts.map(p => {
    const image = p.image_url
      ? "<img src=\"" + escapeHtml(p.image_url) + "\" alt=\"" + escapeHtml(p.name) + "\" style=\"width:54px;height:54px;object-fit:cover;border-radius:8px;\">"
      : iconForProduct(p.name);
    return "<div class=\"card\" style=\"margin:10px 0;display:flex;gap:10px;align-items:center;\">" +
      "<div style=\"font-size:28px;\">" + image + "</div>" +
      "<div style=\"flex:1;\"><strong>" + escapeHtml(p.name) + "</strong><div>" + rupiah(p.price) + "</div></div>" +
      "<button type=\"button\" class=\"text-btn\" onclick=\"addToCart(" + Number(p.id) + ")\">Tambah</button>" +
      "<button type=\"button\" class=\"text-btn\" onclick=\"toggleWishlist(" + Number(p.id) + ")\">💔</button>" +
      "</div>";
  }).join("");
}

async function toggleWishlist(productId) {
  if (!currentUser) {
    openAccountPanel();
    showLoginView();
    return;
  }

  const id = Number(productId);
  const isFavorite = wishlistProductIds.has(id);

  if (isFavorite) {
    const { error } = await supabaseClient
      .from("wishlists")
      .delete()
      .eq("user_id", currentUser.id)
      .eq("product_id", id);

    if (error) {
      console.error("Wishlist delete error:", error);
      alert("Gagal menghapus favorit: " + error.message);
      return;
    }

    wishlistProductIds.delete(id);
  } else {
    const { error } = await supabaseClient
      .from("wishlists")
      .insert({ user_id: currentUser.id, product_id: id });

    if (error) {
      console.error("Wishlist insert error:", error);
      alert("Gagal menambahkan favorit: " + error.message);
      return;
    }

    wishlistProductIds.add(id);
  }

  renderProducts();
  renderWishlist();
}


/* =========================
   NOTIFICATIONS
========================= */

function notificationTypeIcon(type) {
  return ({
    order_created: "🛒",
    order_status: "📦",
    payment: "💳",
    refund: "💰",
    promo: "🎟️",
    stock: "⚠️",
    general: "🔔",
    new_order: "🛒"
  })[type] || "🔔";
}

function renderNotificationList(items = []) {
  const container = document.querySelector("#notificationList");
  if (!container) return;

  if (!currentUser) {
    container.innerHTML = "Login untuk melihat notifikasi.";
    return;
  }

  if (!items.length) {
    container.innerHTML = "<p>Belum ada notifikasi.</p>";
    return;
  }

  container.innerHTML = items.map(item => {
    const unreadClass = item.is_read ? "" : " unread";
    const orderLink = item.order_id
      ? "<small>Pesanan #" + Number(item.order_id) + "</small>"
      : "";
    return `
      <div class="notification-item${unreadClass}" data-notification-id="${Number(item.id)}">
        <div>${notificationTypeIcon(item.type)} ${escapeHtml(item.title)}</div>
        <div style="margin-top:4px;font-weight:400;">${escapeHtml(item.message)}</div>
        ${orderLink}
        <span class="notification-time">${new Date(item.created_at).toLocaleString("id-ID")}</span>
        ${!item.is_read ? `
          <button type="button" class="text-btn" style="margin-top:6px;" onclick="markNotificationRead(${Number(item.id)})">
            Tandai dibaca
          </button>
        ` : ""}
      </div>
    `;
  }).join("");
}

async function loadNotifications() {
  if (!currentUser) return;

  const list = document.querySelector("#notificationList");
  if (list && !list.dataset.loaded) {
    list.innerHTML = "<p>Memuat notifikasi...</p>";
  }

  const { data, error } = await supabaseClient
    .from("notifications")
    .select("id,type,title,message,order_id,is_read,created_at")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Notification load error:", error);
    if (list) list.innerHTML = "<p>Notifikasi belum bisa dimuat: " + escapeHtml(error.message) + "</p>";
    return;
  }

  if (list) list.dataset.loaded = "1";
  renderNotificationList(data || []);

  const { count, error: countError } = await supabaseClient
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", currentUser.id)
    .eq("is_read", false);

  if (countError) {
    console.error("Notification count error:", countError);
    return;
  }

  updateNotificationBadge(count || 0);
}

function updateNotificationBadge(count) {
  const badge = document.querySelector("#notificationBadge");
  if (!badge) return;
  const value = Number(count) || 0;
  badge.textContent = value > 99 ? "99+" : String(value);
  badge.style.display = value > 0 ? "inline-block" : "none";
}

async function markNotificationRead(id) {
  if (!currentUser) return;

  const { error } = await supabaseClient
    .from("notifications")
    .update({ is_read: true })
    .eq("id", Number(id))
    .eq("user_id", currentUser.id);

  if (error) {
    alert("Gagal menandai notifikasi: " + error.message);
    return;
  }

  await loadNotifications();
}

async function markAllNotificationsRead() {
  if (!currentUser) return;

  const { error } = await supabaseClient
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", currentUser.id)
    .eq("is_read", false);

  if (error) {
    alert("Gagal menandai notifikasi: " + error.message);
    return;
  }

  await loadNotifications();
}

function openNotificationPanel() {
  const panel = document.querySelector("#notificationPanel");
  if (!panel) return;

  panel.style.display = "block";
  panel.scrollIntoView({ behavior: "smooth", block: "start" });

  if (currentUser) loadNotifications();
}

function closeNotificationRealtime() {
  if (notificationRealtimeChannel) {
    supabaseClient.removeChannel(notificationRealtimeChannel);
    notificationRealtimeChannel = null;
  }
}

function setupNotificationRealtime() {
  closeNotificationRealtime();

  if (!currentUser) return;

  notificationRealtimeChannel = supabaseClient
    .channel("customer-notifications-" + currentUser.id)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "notifications",
        filter: "user_id=eq." + currentUser.id
      },
      async () => {
        await loadNotifications();
      }
    )
    .subscribe();
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
        <article class="product" style="position:relative;">

          <button
            type="button"
            class="wishlist-btn"
            aria-label="${wishlistProductIds.has(Number(p.id)) ? "Hapus dari wishlist" : "Tambah ke wishlist"}"
            title="${wishlistProductIds.has(Number(p.id)) ? "Hapus dari wishlist" : "Tambah ke wishlist"}"
            onclick="toggleWishlist(${Number(p.id)})"
          >
            ${wishlistProductIds.has(Number(p.id)) ? "❤️ Favorit" : "♡ Favorit"}
          </button>

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


function removeFromCart(id) {
  cart = cart.filter(
    item => Number(item.id) !== Number(id)
  );

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
        <div style="margin:10px 0;">
          <strong>${escapeHtml(item.name)}</strong>
          <div>
            × ${Number(item.qty)}
            —
            ${rupiah(
              Number(item.price) *
              Number(item.qty)
            )}
          </div>

          <button
            type="button"
            class="text-btn"
            onclick="removeFromCart(${Number(item.id)})"
          >
            🗑️ Hapus
          </button>
        </div>
      `
    ).join("") +
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

  loadNotifications();
  setupNotificationRealtime();

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

  await loadWishlist();
  await loadAddresses();
  await loadCheckout();
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

  document.querySelector("#addressLatitude").value =
    address.latitude ?? "";
  document.querySelector("#addressLongitude").value =
    address.longitude ?? "";

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

    latitude:
      document.querySelector("#addressLatitude").value
        ? Number(document.querySelector("#addressLatitude").value)
        : null,

    longitude:
      document.querySelector("#addressLongitude").value
        ? Number(document.querySelector("#addressLongitude").value)
        : null,

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
  await loadCheckout();
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
  await loadCheckout();
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
   CHECKOUT
========================= */

async function loadCheckout() {
  const box = document.querySelector("#checkoutBox");
  const hint = document.querySelector("#checkoutLoginHint");
  if (!box || !hint) return;

  if (!currentUser) {
    box.style.display = "none";
    hint.textContent = "Login diperlukan untuk checkout.";
    return;
  }

  box.style.display = "block";
  hint.textContent = "Pilih alamat, lokasi, dan metode pembayaran.";

  const addressSelect = document.querySelector("#checkoutAddress");
  const paymentSelect = document.querySelector("#checkoutPayment");
  const bankSelect = document.querySelector("#checkoutBank");
  const ewalletSelect = document.querySelector("#checkoutEwallet");
  if (!addressSelect || !paymentSelect) return;

  addressSelect.innerHTML = customerAddresses.length
    ? customerAddresses.map(a =>
        `<option value="${a.id}" ${a.is_default ? "selected" : ""}>
          ${escapeHtml(a.label)} — ${escapeHtml(a.city)}
        </option>`
      ).join("")
    : "<option value=''>Belum ada alamat</option>";

  const payments = await supabaseClient
    .from("payment_methods")
    .select("code,name")
    .eq("is_active", true)
    .order("sort_order");

  if (payments.error) {
    paymentSelect.innerHTML =
      "<option value=''>Gagal memuat metode pembayaran</option>";
  } else {
    paymentSelect.innerHTML = (payments.data || [])
      .map(p =>
        `<option value="${escapeHtml(p.code)}">
          ${escapeHtml(p.name)}
        </option>`
      )
      .join("");
  }

  if (bankSelect) {
    const banks = await supabaseClient
      .from("payment_banks")
      .select("code,name")
      .eq("is_active", true)
      .order("sort_order");

    if (banks.error) {
      bankSelect.innerHTML =
        "<option value=''>Gagal memuat daftar bank</option>";
    } else {
      bankSelect.innerHTML =
        "<option value=''>Pilih bank</option>" +
        (banks.data || [])
          .map(b =>
            `<option value="${escapeHtml(b.code)}">
              ${escapeHtml(b.name)}
            </option>`
          )
          .join("");
    }
  }

  if (ewalletSelect) {
    ewalletSelect.innerHTML = `
      <option value="">Pilih E-Wallet</option>
      <option value="gopay">GoPay</option>
      <option value="ovo">OVO</option>
      <option value="dana">DANA</option>
      <option value="shopeepay">ShopeePay</option>
    `;
  }

  updateBankTransferVisibility();
  updateEwalletVisibility();
  await updateShippingPreview();
}

function updateBankTransferVisibility() {
  const paymentMethod =
    document.querySelector("#checkoutPayment")?.value;

  const box =
    document.querySelector("#bankTransferBox");

  if (!box) return;

  box.style.display =
    paymentMethod === "bank_transfer"
      ? "block"
      : "none";
}

function updateEwalletVisibility() {
  const paymentMethod =
    document.querySelector("#checkoutPayment")?.value;

  const box =
    document.querySelector("#ewalletBox");

  if (!box) return;

  box.style.display =
    paymentMethod === "ewallet"
      ? "block"
      : "none";
}

async function updateShippingPreview() {
  const addressId =
    document.querySelector("#checkoutAddress")?.value;

  const target =
    document.querySelector("#checkoutDistance");

  if (!target) return;

  if (!addressId) {
    target.textContent =
      "Simpan alamat terlebih dahulu.";
    return;
  }

  const address =
    customerAddresses.find(
      a => Number(a.id) === Number(addressId)
    );

  if (!address?.latitude || !address?.longitude) {
    target.textContent =
      "Lokasi alamat belum tersedia. Tekan “📍 Ambil / perbarui lokasi alamat”.";
    return;
  }

  target.textContent =
    "Menghitung jarak dan ongkir...";

  const { data, error } =
    await supabaseClient.rpc(
      "customer_shipping_preview",
      {
        p_address_id: Number(addressId)
      }
    );

  if (error) {
    target.textContent =
      "Jarak/ongkir belum dapat dihitung: " +
      error.message;
    return;
  }

  target.textContent =
    `Jarak customer → toko: ${data.distance_km} km · Ongkir otomatis: ${rupiah(data.shipping_fee)}`;
}

async function captureCheckoutLocation() {
  if (!currentUser) return;

  const addressId =
    Number(document.querySelector("#checkoutAddress")?.value);

  const message =
    document.querySelector("#checkoutLocationMessage");

  if (!addressId) {
    setMessage(
      message,
      "Pilih alamat terlebih dahulu."
    );
    return;
  }

  if (!navigator.geolocation) {
    setMessage(
      message,
      "Browser tidak mendukung lokasi perangkat."
    );
    return;
  }

  setMessage(
    message,
    "Meminta izin lokasi perangkat..."
  );

  navigator.geolocation.getCurrentPosition(
    async position => {
      const latitude =
        position.coords.latitude;

      const longitude =
        position.coords.longitude;

      const { error } =
        await supabaseClient
          .from("addresses")
          .update({
            latitude,
            longitude
          })
          .eq("id", addressId)
          .eq("user_id", currentUser.id);

      if (error) {
        console.error(
          "Checkout location save error:",
          error
        );

        setMessage(
          message,
          "Lokasi gagal disimpan: " +
          error.message
        );

        return;
      }

      setMessage(
        message,
        "Lokasi alamat berhasil diperbarui."
      );

      await loadAddresses();
      await loadCheckout();
    },
    error => {
      console.error(
        "Checkout geolocation error:",
        error
      );

      setMessage(
        message,
        "Lokasi gagal diambil: " +
        error.message +
        ". Pastikan izin lokasi browser diizinkan."
      );
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    }
  );
}

async function handleCheckout() {
  if (!currentUser) {
    openAccountPanel();
    showLoginView();
    return;
  }

  if (!cart.length) {
    alert("Keranjang masih kosong.");
    return;
  }

  const addressId =
    Number(
      document.querySelector("#checkoutAddress")?.value
    );

  const paymentMethod =
    document.querySelector("#checkoutPayment")?.value;

  const bankCode =
    paymentMethod === "bank_transfer"
      ? document.querySelector("#checkoutBank")?.value
      : null;

  const ewalletCode =
    paymentMethod === "ewallet"
      ? document.querySelector("#checkoutEwallet")?.value
      : null;

  const message =
    document.querySelector("#checkoutMessage");

  if (!addressId || !paymentMethod) {
    setMessage(
      message,
      "Pilih alamat dan metode pembayaran."
    );
    return;
  }

  if (
    paymentMethod === "bank_transfer" &&
    !bankCode
  ) {
    setMessage(
      message,
      "Pilih bank untuk Transfer Bank."
    );
    return;
  }

  if (
    paymentMethod === "ewallet" &&
    !ewalletCode
  ) {
    setMessage(
      message,
      "Pilih E-Wallet."
    );
    return;
  }

  const address =
    customerAddresses.find(
      a => Number(a.id) === Number(addressId)
    );

  if (!address?.latitude || !address?.longitude) {
    setMessage(
      message,
      "Lokasi alamat belum tersedia. Ambil/perbarui lokasi terlebih dahulu."
    );
    return;
  }

  setMessage(
    message,
    "Membuat pesanan..."
  );

  const { data, error } =
    await supabaseClient.rpc(
      "create_customer_order",
      {
        p_address_id: addressId,
        p_items: cart.map(item => ({
          product_id: Number(item.id),
          quantity: Number(item.qty)
        })),
        p_payment_method: paymentMethod,
        p_customer_note:
          document
            .querySelector("#checkoutNote")
            ?.value
            .trim() || null,
        p_payment_bank_code: bankCode,
        p_payment_ewallet_code: ewalletCode,
        p_promo_code:
          document.querySelector("#checkoutPromo")?.value.trim() || null
      }
    );

  if (error) {
    setMessage(
      message,
      "Gagal membuat pesanan: " +
      error.message
    );
    return;
  }

  cart = [];
  localStorage.setItem(
    "nusantara_cart",
    "[]"
  );
  renderCart();

  const bankText =
    paymentMethod === "bank_transfer"
      ? " · Bank: " +
        (
          document.querySelector("#checkoutBank")
            ?.selectedOptions?.[0]?.textContent ||
          bankCode
        ).trim()
      : "";

  const ewalletText =
    paymentMethod === "ewallet"
      ? " · E-Wallet: " +
        (
          document.querySelector("#checkoutEwallet")
            ?.selectedOptions?.[0]?.textContent ||
          ewalletCode
        ).trim()
      : "";

  const promoText =
    Number(data.discount_amount || 0) > 0
      ? " · Diskon promo " + rupiah(data.discount_amount)
      : "";

  setMessage(
    message,
    `Pesanan ${data.order_number} berhasil dibuat · Jarak ${data.distance_km} km · Ongkir ${rupiah(data.shipping_fee)}${promoText} · Total ${rupiah(data.total_amount)} · Pembayaran: ${data.payment_method}${bankText}${ewalletText}`
  );

  if (paymentMethod !== "cash") {
    try {
      setMessage(message, "Menyiapkan pembayaran Xendit...");
      let paymentOrderId = data.order_id;

      if (!paymentOrderId) {
        const lookup = await supabaseClient
          .from("orders")
          .select("id")
          .eq("order_number", data.order_number)
          .maybeSingle();

        paymentOrderId = lookup.data?.id;
      }

      if (!paymentOrderId) {
        throw new Error("ID pesanan tidak ditemukan.");
      }

      await startXenditPayment(paymentOrderId);
    } catch (paymentError) {
      console.error("Xendit error:", paymentError);
      setMessage(
        message,
        "Pesanan berhasil dibuat, tetapi pembayaran belum dapat dibuka: " +
        paymentError.message
      );
    }
  }
}

/* =========================
   XENDIT PAYMENT
========================= */

async function startXenditPayment(orderId) {
  const session = await supabaseClient.auth.getSession();
  const accessToken = session?.data?.session?.access_token;

  if (!accessToken) {
    throw new Error("Sesi login sudah berakhir. Silakan login kembali.");
  }

  const response = await fetch(
    SUPABASE_FUNCTION_URL + "/xendit-create-session",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + accessToken
      },
      body: JSON.stringify({
        order_id: Number(orderId)
      })
    }
  );

  const result = await response.json().catch(() => ({}));

  if (!response.ok || !result.payment_link_url) {
    const detail =
      result.detail?.message ||
      result.detail?.error_code ||
      (typeof result.detail === "string" ? result.detail : "");

    throw new Error(
      detail
        ? `${result.error || "Gagal membuat pembayaran Xendit."} [${result.xendit_status || response.status}]: ${detail}`
        : (result.error || "Gagal membuat pembayaran Xendit.")
    );
  }

  window.location.href = result.payment_link_url;
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

  const getAddressLocation = document.querySelector("#getAddressLocation");
  if (getAddressLocation) {
    getAddressLocation.addEventListener("click", () => {
      if (!navigator.geolocation) {
        alert("Browser tidak mendukung lokasi.");
        return;
      }
      setMessage(document.querySelector("#addressMessage"), "Mengambil lokasi...");
      navigator.geolocation.getCurrentPosition(
        pos => {
          document.querySelector("#addressLatitude").value = pos.coords.latitude;
          document.querySelector("#addressLongitude").value = pos.coords.longitude;
          setMessage(document.querySelector("#addressMessage"), "Lokasi tersimpan. Sekarang simpan alamat.");
        },
        err => setMessage(document.querySelector("#addressMessage"), "Lokasi gagal diambil: " + err.message),
        {enableHighAccuracy:true, timeout:15000}
      );
    });
  }

  const checkoutButton =
    document.querySelector("#checkoutButton");

  if (checkoutButton) {
    checkoutButton.addEventListener(
      "click",
      handleCheckout
    );
  }

  const checkoutAddress =
    document.querySelector("#checkoutAddress");

  if (checkoutAddress) {
    checkoutAddress.addEventListener(
      "change",
      updateShippingPreview
    );
  }

  const checkoutPayment =
    document.querySelector("#checkoutPayment");

  if (checkoutPayment) {
    checkoutPayment.addEventListener(
      "change",
      () => {
        updateBankTransferVisibility();
        updateEwalletVisibility();
      }
    );
  }

  const checkoutLocationButton =
    document.querySelector("#checkoutLocationButton");

  if (checkoutLocationButton) {
    checkoutLocationButton.addEventListener(
      "click",
      captureCheckoutLocation
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
   CUSTOMER ORDERS
========================= */

async function showHomePage() {
  document.querySelector("#ageNotice")?.style.setProperty("display", "block");
  document.querySelector("#productsSection")?.style.setProperty("display", "block");
  document.querySelector("#cartSection")?.style.setProperty("display", "block");
  document.querySelector("#checkoutSection")?.style.setProperty("display", "block");
  document.querySelector("#customerOrdersSection")?.style.setProperty("display", "none");
}

async function showOrdersPage() {
  // Pastikan sesi dan currentUser siap sebelum memuat riwayat pesanan.
  if (!currentUser) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session?.user) {
      currentUser = session.user;
    }
  }

  document.querySelector("#ageNotice")?.style.setProperty("display", "none");
  document.querySelector("#productsSection")?.style.setProperty("display", "none");
  document.querySelector("#cartSection")?.style.setProperty("display", "none");
  document.querySelector("#checkoutSection")?.style.setProperty("display", "none");
  document.querySelector("#customerOrdersSection")?.style.setProperty("display", "block");

  if (!currentUser) {
    openAccountPanel();
    showLoginView();
    return;
  }

  await loadCustomerOrders();
  document.querySelector("#customerOrdersSection")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function orderStatusLabel(status) {
  return ({
    pending: "Menunggu pembayaran",
    confirmed: "Pesanan dikonfirmasi",
    processing: "Sedang diproses",
    shipped: "Sedang dikirim",
    delivered: "Pesanan selesai",
    cancelled: "Pesanan dibatalkan",
    refunded: "Pesanan dikembalikan"
  })[status] || status;
}

function orderTimelineHtml(status) {
  const steps = [
    ["pending", "Pesanan dibuat"],
    ["confirmed", "Dikonfirmasi"],
    ["processing", "Diproses"],
    ["shipped", "Dikirim"],
    ["delivered", "Selesai"]
  ];

  const order = ["pending", "confirmed", "processing", "shipped", "delivered"];
  const currentIndex = order.indexOf(status);

  if (status === "cancelled" || status === "refunded") {
    return `
      <div style="margin-top:10px;">
        <strong>${escapeHtml(orderStatusLabel(status))}</strong>
      </div>
    `;
  }

  return `
    <div style="margin-top:12px;">
      ${steps.map(([key, label], index) => {
        const active = currentIndex >= index;
        return `
          <div style="padding:6px 0;">
            <span>${active ? "●" : "○"}</span>
            ${escapeHtml(label)}
          </div>
        `;
      }).join("")}
    </div>
  `;
}


async function getCustomerMapData(orderId) {
  const sessionResult = await supabaseClient.auth.getSession();
  const accessToken = sessionResult?.data?.session?.access_token;
  if (!accessToken) throw new Error("Sesi login sudah berakhir.");
  const response = await fetch(SUPABASE_FUNCTION_URL + "/customer-map-data", {
    method: "POST",
    headers: {"Content-Type":"application/json","Authorization":"Bearer " + accessToken},
    body: JSON.stringify({order_id:Number(orderId)})
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.error || "Data peta tidak tersedia.");
  return result;
}

function destroyOrderMap(orderId) {
  const id=Number(orderId);
  if (orderMapChannels[id]) { supabaseClient.removeChannel(orderMapChannels[id]); delete orderMapChannels[id]; }
  if (orderMapInstances[id]) { orderMapInstances[id].remove(); delete orderMapInstances[id]; }
}

async function drawOrderRoute(map, fromLat, fromLng, toLat, toLng, state) {
  try {
    const url="https://router.project-osrm.org/route/v1/driving/"+fromLng+","+fromLat+";"+toLng+","+toLat+"?overview=full&geometries=geojson";
    const response=await fetch(url);
    if (!response.ok) throw new Error("Routing service error");
    const result=await response.json();
    const route=result?.routes?.[0];
    if (!route) throw new Error("Rute tidak ditemukan.");
    if (state.layer) map.removeLayer(state.layer);
    state.layer=L.geoJSON(route.geometry,{style:{weight:5,opacity:0.75}}).addTo(map);
    state.etaText=Math.max(1,Math.round(Number(route.duration||0)/60))+" menit";
  } catch(error) {
    console.warn("Route OSRM gagal:",error);
    state.etaText=null;
  }
  return state;
}

async function initOrderMap(orderId) {
  const id=Number(orderId);
  const container=document.querySelector("#orderMap_"+id);
  const meta=document.querySelector("#orderMapMeta_"+id);
  if (!container || !window.L) return;
  destroyOrderMap(id);
  container.innerHTML='<div style="padding:20px;text-align:center;">Memuat peta perjalanan...</div>';
  try {
    const data=await getCustomerMapData(id);
    const store=data.store, destination=data.destination;
    const tracking=data.tracking || {latitude:store.latitude,longitude:store.longitude,status:"at_store",updated_at:new Date().toISOString()};
    container.innerHTML="";
    const map=L.map(container,{zoomControl:false}).setView([Number(tracking.latitude),Number(tracking.longitude)],13);
    L.control.zoom({position:"bottomright"}).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"&copy; OpenStreetMap contributors"}).addTo(map);
    L.circleMarker([Number(store.latitude),Number(store.longitude)],{radius:8,weight:3,fillOpacity:1}).addTo(map).bindTooltip("🏪 Toko");
    L.circleMarker([Number(destination.latitude),Number(destination.longitude)],{radius:8,weight:3,fillOpacity:1}).addTo(map).bindTooltip("🏠 Tujuan");
    const courierMarker=L.circleMarker([Number(tracking.latitude),Number(tracking.longitude)],{radius:10,weight:3,fillOpacity:1}).addTo(map).bindTooltip("🚚 Kurir",{permanent:true});
    const state={layer:null,etaText:null};
    const updateMeta=(current)=>{
      const statusText=current.status==="arrived"?"Kurir sudah tiba":current.status==="on_delivery"?"Kurir sedang menuju alamat":"Kurir berada di toko";
      const updated=current.updated_at?new Date(current.updated_at).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"}):"-";
      if(meta) meta.innerHTML="<strong>"+escapeHtml(statusText)+"</strong>"+(state.etaText?" · ETA "+escapeHtml(state.etaText):"")+"<br><small>Update terakhir "+escapeHtml(updated)+"</small>";
    };
    const updateCourier=async(current)=>{
      const lat=Number(current.latitude),lng=Number(current.longitude);
      if(!Number.isFinite(lat)||!Number.isFinite(lng)) return;
      courierMarker.setLatLng([lat,lng]);
      await drawOrderRoute(map,lat,lng,Number(destination.latitude),Number(destination.longitude),state);
      updateMeta(current);
      map.fitBounds(L.latLngBounds([[lat,lng],[Number(destination.latitude),Number(destination.longitude)]]),{padding:[35,35],maxZoom:15});
    };
    await updateCourier(tracking);
    const channel=supabaseClient.channel("order-tracking-"+id).on("postgres_changes",{event:"UPDATE",schema:"public",table:"order_tracking",filter:"order_id=eq."+id},async(payload)=>{await updateCourier(payload.new);}).subscribe();
    orderMapInstances[id]=map; orderMapChannels[id]=channel;
  } catch(error) {
    console.error("Order map error:",error);
    container.innerHTML='<div style="padding:20px;text-align:center;">'+escapeHtml(error.message||"Peta belum dapat dimuat.")+"</div>";
    if(meta) meta.textContent="Lokasi perjalanan belum tersedia.";
  }
}

async function initAllOrderMaps(orders) {
  for (const order of orders) await initOrderMap(order.id);
}

async function loadCustomerOrders() {
  await setupCustomerPaymentRealtime();
  const container = document.querySelector("#customerOrders");
  if (!container || !currentUser) return;

  container.innerHTML = `
    <div class="card">
      <strong>Memuat pesanan...</strong>
    </div>
  `;

  const { data, error } = await supabaseClient
    .from("orders")
    .select(`
      id,
      order_number,
      address_id,
      status,
      subtotal,
      discount_amount,
      shipping_fee,
      payment_fee,
      total_amount,
      created_at,
      payments (
        id,
        provider,
        payment_method,
        payment_bank_code,
        payment_ewallet_code,
        status,
        transaction_id,
        refund_status,
        refund_amount,
        refund_reason
      ),
      order_items (
        id,
        product_id,
        quantity,
        unit_price,
        subtotal,
        products (
          name,
          image_url
        )
      )
    `)
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Customer orders load error:", error);
    container.innerHTML = `
      <div class="card">
        <strong>Pesanan belum bisa dimuat.</strong>
        <div style="margin-top:8px;">${escapeHtml(error.message)}</div>
      </div>
    `;
    return;
  }

  const orders = data || [];

  if (!orders.length) {
    container.innerHTML = `
      <div class="card">Belum ada pesanan.</div>
    `;
    return;
  }

  container.innerHTML = orders.map(order => {
    const payment = Array.isArray(order.payments) ? order.payments[0] : order.payments;
    const items = Array.isArray(order.order_items) ? order.order_items : [];
    const paymentStatus = payment?.status || "pending";
    const canModify =
      order.status === "pending" &&
      paymentStatus !== "paid";

    const canPay =
      canModify &&
      paymentStatus !== "paid";

    const itemText = items.length
      ? items.map(item => `${escapeHtml(item.products?.name || "Produk")} × ${Number(item.quantity)}`).join(", ")
      : "Detail produk tidak tersedia";

    const paymentLabel =
      paymentStatus === "paid"
        ? (payment?.refund_status === "succeeded"
            ? "Sudah direfund"
            : payment?.refund_status === "requested"
              ? "Refund diajukan"
              : payment?.refund_status === "pending"
                ? "Refund diproses"
                : payment?.refund_status === "failed"
                  ? "Refund gagal"
                  : "Sudah dibayar")
        : paymentStatus === "expired" ? "Pembayaran kedaluwarsa" :
          paymentStatus === "failed" ? "Pembayaran gagal" :
          "Belum dibayar";

    const canRequestRefund =
      paymentStatus === "paid" &&
      ["none", "failed"].includes(payment?.refund_status || "none");

    const mapBox = `      <div class="card" style="margin-top:12px;">
        <strong>📍 Perjalanan pesanan</strong>
        <div id="orderMap_${Number(order.id)}" style="margin-top:8px;height:280px;border-radius:12px;overflow:hidden;background:#f2f2f2;">
          <div style="padding:20px;text-align:center;">Memuat peta perjalanan...</div>
        </div>
        <div id="orderMapMeta_${Number(order.id)}" style="margin-top:8px;">Menghubungkan tracking kurir...</div>
        <small style="display:block;margin-top:8px;">🚚 Posisi kurir diperbarui realtime saat sistem menerima lokasi baru.</small>
      </div>
    `;

    return `
      <article class="card" style="margin:10px 0;">
        <strong>${escapeHtml(order.order_number)}</strong>

        <div style="margin-top:6px;">
          Status:
          <strong>${escapeHtml(orderStatusLabel(order.status))}</strong>
        </div>

        <div style="margin-top:6px;">
          Pembayaran:
          <strong>${escapeHtml(paymentLabel)}</strong>
        </div>

        <div style="margin-top:6px;">${itemText}</div>

        <div style="margin-top:6px;">
          Total: <strong>${rupiah(order.total_amount)}</strong>
        </div>

        ${orderTimelineHtml(order.status)}

        ${canPay ? `
          <button type="button" class="add" style="margin-top:10px;" onclick="payCustomerOrder(${Number(order.id)})">
            Bayar
          </button>
        ` : ""}

        ${canModify ? `
          <button type="button" class="text-btn" onclick="editCustomerOrder(${Number(order.id)})">
            Edit pesanan
          </button>
          <button type="button" class="text-btn" onclick="cancelCustomerOrder(${Number(order.id)})">
            Cancel pesanan
          </button>
        ` : ""}

        ${order.status === "cancelled" ? `
          <button type="button" class="text-btn" onclick="deleteCustomerOrder(${Number(order.id)})">
            Hapus pesanan
          </button>
        ` : ""}

        ${canRequestRefund ? `
          <button type="button" class="text-btn" onclick="requestCustomerRefund(${Number(order.id)})">
            Ajukan refund
          </button>
        ` : ""}

        ${payment?.refund_status === "requested" ? `
          <small style="display:block;margin-top:8px;">
            ⏳ Permintaan refund sedang menunggu Owner.
          </small>
        ` : ""}

        ${payment?.refund_status === "succeeded" ? `
          <small style="display:block;margin-top:8px;">
            ✓ Refund berhasil diproses.
          </small>
        ` : ""}

        ${mapBox}

        <small style="display:block;margin-top:8px;">
          ${new Date(order.created_at).toLocaleString("id-ID")}
        </small>
      </article>
    `;
  }).join("");

  await initAllOrderMaps(orders);
}

async function setupCustomerPaymentRealtime() {
  if (paymentRealtimeChannel) {
    await supabaseClient.removeChannel(paymentRealtimeChannel);
    paymentRealtimeChannel = null;
  }

  paymentRealtimeChannel = supabaseClient
    .channel("customer-payment-realtime")
    .on("postgres_changes", { event:"*", schema:"public", table:"payments" }, async () => {
      if (currentUser) await loadCustomerOrders();
    })
    .subscribe();
}

async function callPaymentRefund(orderId, action, reason = "REQUESTED_BY_CUSTOMER") {
  const session = await supabaseClient.auth.getSession();
  const accessToken = session?.data?.session?.access_token;
  if (!accessToken) throw new Error("Sesi login sudah berakhir. Silakan login kembali.");

  const response = await fetch(SUPABASE_FUNCTION_URL + "/payment-refund", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + accessToken },
    body: JSON.stringify({ order_id:Number(orderId), action, reason })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) {
    throw new Error(result.error || result.detail?.message || "Aksi refund gagal.");
  }
  return result;
}

async function requestCustomerRefund(orderId) {
  if (!confirm("Ajukan refund untuk pembayaran pesanan ini?\n\nPermintaan akan masuk ke Owner untuk diproses.")) return;
  try {
    const result = await callPaymentRefund(orderId, "request", "REQUESTED_BY_CUSTOMER");
    alert(result.message || "Permintaan refund berhasil diajukan.");
    await loadCustomerOrders();
  } catch (error) {
    alert("Refund gagal diajukan: " + error.message);
  }
}

async function callCustomerOrderAction(orderId, action) {
  const session = await supabaseClient.auth.getSession();
  const accessToken = session?.data?.session?.access_token;
  if (!accessToken) throw new Error("Sesi login sudah berakhir. Silakan login kembali.");

  const response = await fetch(
    SUPABASE_FUNCTION_URL + "/customer-order-actions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + accessToken
      },
      body: JSON.stringify({
        order_id: Number(orderId),
        action
      })
    }
  );

  const result = await response.json().catch(() => ({}));

  if (!response.ok || !result.ok) {
    throw new Error(result.error || "Aksi pesanan gagal.");
  }

  return result;
}

async function cancelCustomerOrder(orderId) {
  if (!confirm("Batalkan pesanan ini? Stok produk akan dikembalikan.")) return;

  try {
    await callCustomerOrderAction(orderId, "cancel");
    alert("Pesanan berhasil dibatalkan.");
    await loadCustomerOrders();
  } catch (error) {
    alert("Gagal membatalkan pesanan: " + error.message);
  }
}

async function editCustomerOrder(orderId) {
  if (!confirm("Edit pesanan akan membatalkan pesanan lama dan mengembalikan produknya ke keranjang. Lanjutkan?")) return;

  try {
    const { data, error } = await supabaseClient
      .from("orders")
      .select("id, status, payments(status), order_items(product_id, quantity, unit_price, products(id,name,price,image_url))")
      .eq("id", Number(orderId))
      .eq("user_id", currentUser.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("Pesanan tidak ditemukan.");

    const payment = Array.isArray(data.payments) ? data.payments[0] : data.payments;
    if (data.status !== "pending" || payment?.status === "paid") {
      throw new Error("Pesanan ini sudah tidak bisa diedit.");
    }

    await callCustomerOrderAction(orderId, "cancel");

    const items = data.order_items || [];
    for (const item of items) {
      const product = item.products;
      if (!product) continue;

      const existing = cart.find(x => Number(x.id) === Number(product.id));
      if (existing) {
        existing.qty += Number(item.quantity);
      } else {
        cart.push({
          id: product.id,
          name: product.name,
          price: Number(product.price),
          image_url: product.image_url,
          qty: Number(item.quantity)
        });
      }
    }

    localStorage.setItem("nusantara_cart", JSON.stringify(cart));
    renderCart();
    await showHomePage();
    document.querySelector("#cartSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
    alert("Pesanan lama dibatalkan dan produknya sudah dikembalikan ke keranjang. Silakan ubah lalu checkout lagi.");
  } catch (error) {
    alert("Gagal mengedit pesanan: " + error.message);
  }
}

async function deleteCustomerOrder(orderId) {
  if (!confirm("Hapus pesanan yang sudah dibatalkan ini?")) return;

  try {
    await callCustomerOrderAction(orderId, "delete");
    alert("Pesanan berhasil dihapus.");
    await loadCustomerOrders();
  } catch (error) {
    alert("Gagal menghapus pesanan: " + error.message);
  }
}

async function payCustomerOrder(orderId) {
  if (!currentUser) {
    openAccountPanel();
    showLoginView();
    return;
  }

  const message = document.querySelector("#ordersMessage");

  try {
    setMessage(message, "Menyiapkan pembayaran Xendit...");
    await startXenditPayment(orderId);
  } catch (error) {
    console.error("Customer order payment error:", error);
    setMessage(message, "Pembayaran belum dapat dibuka: " + error.message);
    await loadCustomerOrders();
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

  const notificationButton =
    document.querySelector(
      "#notificationButton"
    );

  const markAllNotificationsButton =
    document.querySelector(
      "#markAllNotificationsButton"
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

        showHomePage();
        window.scrollTo({ top: 0, behavior: "smooth" });
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

        // Set user dari session terlebih dahulu agar Pesanan
        // langsung memuat riwayat tanpa harus membuka Home.
        currentUser = session.user;
        await showOrdersPage();
      }
    );
  }


  if (notificationButton) {
    notificationButton.addEventListener(
      "click",
      async () => {
        const { data: { session } } = await supabaseClient.auth.getSession();

        if (!session) {
          openAccountPanel();
          showLoginView();
          return;
        }

        currentUser = session.user;
        openNotificationPanel();
        await loadNotifications();
      }
    );
  }

  if (markAllNotificationsButton) {
    markAllNotificationsButton.addEventListener(
      "click",
      markAllNotificationsRead
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
      closeNotificationRealtime();
      updateNotificationBadge(0);
      const notificationPanel = document.querySelector("#notificationPanel");
      if (notificationPanel) notificationPanel.style.display = "none";
      const notificationList = document.querySelector("#notificationList");
      if (notificationList) {
        delete notificationList.dataset.loaded;
        notificationList.innerHTML = "Login untuk melihat notifikasi.";
      }

      showLoginView();
    }
  }
);


/* =========================
   START
========================= */

renderCart();

showHomePage();

setupNavigation();

setupAuthForms();

setupCustomerForms();

checkSession();

loadProducts();
