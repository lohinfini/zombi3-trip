(() => {
  "use strict";
  const USER_KEY = "zombi3TripDemoUser";
  const read = key => { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; } };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const currentUser = () => read(USER_KEY);
  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const api = async (url, options = {}) => {
    const response = await fetch(url, { credentials: "same-origin", ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Не удалось выполнить запрос.");
    return data;
  };
  const nav = document.querySelector(".main-nav");
  const cta = document.querySelector(".header-cta");
  const user = currentUser();
  if (nav && !document.querySelector("[data-auth-nav]")) {
    const link = document.createElement("a");
    link.href = user ? "profile.html" : "login.html";
    link.dataset.authNav = "true";
    link.textContent = user ? "Личный кабинет" : "Войти";
    nav.append(link);
  }
  if (cta && user) { cta.href = "profile.html"; cta.innerHTML = 'Личный кабинет <span>↗</span>'; }

  document.querySelectorAll("[data-password-toggle]").forEach(button => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.passwordToggle);
      if (!input) return;
      input.type = input.type === "password" ? "text" : "password";
      button.textContent = input.type === "password" ? "Показать" : "Скрыть";
    });
  });

  const registerForm = document.querySelector("#register-form");
  if (registerForm) registerForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!registerForm.reportValidity()) return;
    const feedback = document.querySelector("#auth-feedback");
    const button = registerForm.querySelector('[type="submit"]');
    feedback.textContent = "";
    button.disabled = true;
    try {
      const result = await api("/api/auth/register", { method: "POST", body: JSON.stringify({
        name: registerForm.elements.name.value.trim(),
        email: registerForm.elements.email.value.trim().toLowerCase(),
        password: registerForm.elements.password.value
      })});
      write(USER_KEY, result.user);
      window.location.href = "profile.html?welcome=1";
    } catch (error) { feedback.textContent = error.message; }
    finally { button.disabled = false; }
  });

  const loginForm = document.querySelector("#login-form");
  if (loginForm) loginForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!loginForm.reportValidity()) return;
    const feedback = document.querySelector("#auth-feedback");
    const button = loginForm.querySelector('[type="submit"]');
    feedback.textContent = "";
    button.disabled = true;
    try {
      const result = await api("/api/auth/login", { method: "POST", body: JSON.stringify({
        email: loginForm.elements.email.value.trim().toLowerCase(),
        password: loginForm.elements.password.value
      })});
      write(USER_KEY, result.user);
      window.location.href = "profile.html";
    } catch (error) { feedback.textContent = error.message; }
    finally { button.disabled = false; }
  });

  const profile = document.querySelector("#profile-content");
  if (profile) {
    (async () => {
      try {
        const { user: signedIn } = await api("/api/auth/me");
        write(USER_KEY, signedIn);
        const welcome = new URLSearchParams(location.search).has("welcome");
        profile.innerHTML = `
          ${welcome ? '<p class="auth-success">Аккаунт успешно создан!</p>' : ""}
          <div class="profile-avatar">${escapeHTML((signedIn.name || "G").charAt(0).toUpperCase())}</div>
          <p class="eyebrow"><span class="eyebrow-dot"></span> ЛИЧНЫЙ КАБИНЕТ</p>
          <h1>Привет, <em>${escapeHTML(signedIn.name.split(" ")[0])}!</em></h1>
          <p class="auth-subtitle">Управляйте аккаунтом и просматривайте заявки на бронирование.</p>
          <div class="profile-details"><div><span>ИМЯ</span><strong>${escapeHTML(signedIn.name)}</strong></div><div><span>ЭЛЕКТРОННАЯ ПОЧТА</span><strong>${escapeHTML(signedIn.email)}</strong></div></div>
          <div class="profile-bookings"><h2>Ваши заявки</h2><div id="profile-bookings-list"><p class="auth-muted">Загружаем заявки…</p></div></div>
          <button class="button button-dark auth-submit" id="logout-button" type="button">Выйти <span>↗</span></button>`;
        const list = document.querySelector("#profile-bookings-list");
        const { bookings } = await api("/api/bookings");
        const roomNames = {"Classic Double":"Классический двухместный","Deluxe King":"Делюкс с кроватью King","City Suite":"Городской люкс"};
        list.innerHTML = bookings.length ? bookings.map(item => `<article class="saved-booking"><strong>${escapeHTML(roomNames[item.room] || item.room)}</strong><span>${escapeHTML(String(item.checkin).slice(0,10))} → ${escapeHTML(String(item.checkout).slice(0,10))}</span><span>${Number(item.nights)} ноч. · €${Number(item.total).toLocaleString("ru-RU")}</span><span>Статус: ${escapeHTML(item.status === "pending" ? "Ожидает подтверждения" : item.status)}</span></article>`).join("") : '<p class="auth-muted">Пока нет заявок. <a href="booking.html">Запланировать проживание →</a></p>';
        document.querySelector("#logout-button").addEventListener("click", async () => {
          try { await api("/api/auth/logout", { method: "POST", body: "{}" }); } catch (_) {}
          localStorage.removeItem(USER_KEY);
          window.location.href = "index.html";
        });
      } catch (_) {
        localStorage.removeItem(USER_KEY);
        window.location.replace("login.html?next=profile");
      }
    })();
  }

  const favorites = new Set(read("zombi3TripFavorites") || []);
  document.querySelectorAll(".room-card, .room-row").forEach(card => {
    const heading = card.querySelector("h3, h2");
    if (!heading) return;
    const rawRoomName = heading.textContent.trim();
    const roomName = ({"Classic Double":"Классический двухместный","Deluxe King":"Делюкс с кроватью King","City Suite":"Городской люкс"})[rawRoomName] || rawRoomName;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "favorite-toggle";
    button.setAttribute("aria-label", `${favorites.has(roomName) ? "Убрать" : "В избранное"} ${roomName}`);
    button.setAttribute("aria-pressed", String(favorites.has(roomName)));
    button.textContent = favorites.has(roomName) ? "♥ В избранном" : "♡ В избранное";
    button.addEventListener("click", () => {
      if (favorites.has(roomName)) favorites.delete(roomName); else favorites.add(roomName);
      write("zombi3TripFavorites", [...favorites]);
      button.textContent = favorites.has(roomName) ? "♥ В избранном" : "♡ В избранное";
      button.setAttribute("aria-pressed", String(favorites.has(roomName)));
    });
    const details = card.querySelector(".room-details, .room-row-copy");
    if (details) details.append(button);
  });
  document.querySelectorAll('a[href^="#"]').forEach(link => link.addEventListener("click", event => {
    const target = document.querySelector(link.getAttribute("href"));
    if (target) { event.preventDefault(); target.scrollIntoView({behavior: "smooth", block: "start"}); }
  }));
  document.querySelectorAll("img").forEach(img => { if (!img.hasAttribute("loading") && !img.closest(".hero-visual")) img.loading = "lazy"; });
})();