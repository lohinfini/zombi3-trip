(() => {
  "use strict";

  const roomPrices = {
    "Classic Double": 120,
    "Deluxe King": 165,
    "City Suite": 220
  };

  const menuToggle = document.querySelector(".menu-toggle");
  const mainNav = document.querySelector(".main-nav");
  if (menuToggle && mainNav) {
    menuToggle.addEventListener("click", () => {
      const open = menuToggle.getAttribute("aria-expanded") !== "true";
      menuToggle.setAttribute("aria-expanded", String(open));
      mainNav.classList.toggle("is-open", open);
    });
    mainNav.querySelectorAll("a").forEach(link => {
      link.addEventListener("click", () => {
        menuToggle.setAttribute("aria-expanded", "false");
        mainNav.classList.remove("is-open");
      });
    });
  }

  const bookingForm = document.querySelector("#booking-form");
  if (!bookingForm) return;

  const checkin = document.querySelector("#checkin");
  const checkout = document.querySelector("#checkout");
  const room = document.querySelector("#room");
  const guests = document.querySelector("#guests");
  const nightsField = document.querySelector("#nights-field");
  const summaryRoom = document.querySelector("#summary-room");
  const summaryImage = document.querySelector(".summary-image img");
  const summaryImageWrap = document.querySelector(".summary-image");
  const roomImages = {
    "Classic Double": {
      src: "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=900&q=85",
      alt: "Классический двухместный номер с уютной кроватью"
    },
    "Deluxe King": {
      src: "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=900&q=85",
      alt: "Просторный номер Делюкс с кроватью King-size"
    },
    "City Suite": {
      src: "https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=900&q=85",
      alt: "Городской люкс с отдельной зоной отдыха"
    }
  };
  const summaryNights = document.querySelector("#summary-nights");
  const summaryGuests = document.querySelector("#summary-guests");
  const summaryRate = document.querySelector("#summary-rate");
  const summaryLength = document.querySelector("#summary-length");
  const summaryTotal = document.querySelector("#summary-total");
  const toast = document.querySelector("#booking-toast");
  const toastMessage = document.querySelector("#toast-message");
  const toastClose = document.querySelector("#toast-close");

  const money = value => new Intl.NumberFormat("ru-RU", {
    style: "currency", currency: "EUR", maximumFractionDigits: 0
  }).format(value);

  const localDateString = date => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  checkin.min = localDateString(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(today);
  dayAfter.setDate(dayAfter.getDate() + 2);
  checkin.value = localDateString(tomorrow);
  checkout.min = localDateString(dayAfter);
  checkout.value = localDateString(dayAfter);

  const params = new URLSearchParams(window.location.search);
  const requestedRoom = params.get("room");
  if (requestedRoom && roomPrices[requestedRoom]) room.value = requestedRoom;

  function nightCount() {
    if (!checkin.value || !checkout.value) return 0;
    const start = new Date(`${checkin.value}T12:00:00`);
    const end = new Date(`${checkout.value}T12:00:00`);
    return Math.round((end - start) / 86400000);
  }

  function updateCheckoutMinimum() {
    if (!checkin.value) return;
    const next = new Date(`${checkin.value}T12:00:00`);
    next.setDate(next.getDate() + 1);
    const minimum = localDateString(next);
    checkout.min = minimum;
    if (checkout.value && checkout.value < minimum) checkout.value = minimum;
  }

  function updateSummary() {
    const nights = Math.max(0, nightCount());
    const count = Number(guests.value || 2);
    const price = roomPrices[room.value] || roomPrices["Classic Double"];
    const nightLabel = `${nights} ${nights === 1 ? "ночь" : (nights >= 2 && nights <= 4 ? "ночи" : "ночей")}`;
    const guestLabel = `${count} ${count === 1 ? "гость" : (count >= 2 && count <= 4 ? "гостя" : "гостей")}`;
    nightsField.textContent = nightLabel;
    summaryRoom.textContent = ({"Classic Double":"Классический двухместный","Deluxe King":"Делюкс с кроватью King","City Suite":"Городской люкс"})[room.value] || room.value;
    const photo = roomImages[room.value] || roomImages["Classic Double"];
    if (summaryImage && summaryImage.src !== photo.src) {
      summaryImage.classList.add("is-changing");
      const nextImage = new Image();
      nextImage.onload = () => {
        summaryImage.src = photo.src;
        summaryImage.alt = photo.alt;
        summaryImage.classList.remove("is-changing");
      };
      nextImage.onerror = () => summaryImage.classList.remove("is-changing");
      nextImage.src = photo.src;
    } else if (summaryImage) {
      summaryImage.alt = photo.alt;
    }
    if (summaryImageWrap) summaryImageWrap.dataset.room = room.value;
    summaryNights.textContent = nightLabel;
    summaryGuests.textContent = guestLabel;
    summaryRate.innerHTML = `${money(price)} <small>/ ночь</small>`;
    summaryLength.textContent = nightLabel;
    summaryTotal.textContent = money(price * nights);
  }

  checkin.addEventListener("change", () => {
    updateCheckoutMinimum();
    updateSummary();
  });
  checkout.addEventListener("change", updateSummary);
  room.addEventListener("change", updateSummary);
  guests.addEventListener("change", updateSummary);

  bookingForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!bookingForm.reportValidity()) return;

    const nights = nightCount();
    if (nights < 1) {
      checkout.setCustomValidity("Дата выезда должна быть минимум на один день позже даты заезда.");
      checkout.reportValidity();
      checkout.setCustomValidity("");
      return;
    }

    const formData = new FormData(bookingForm);
    const price = roomPrices[room.value] || roomPrices["Classic Double"];
    const request = {
      name: String(formData.get("name")).trim(),
      email: String(formData.get("email")).trim(),
      checkin: checkin.value,
      checkout: checkout.value,
      room: room.value,
      guests: Number(guests.value),
      nights,
      total: price * nights,
      requestedAt: new Date().toISOString()
    };

    const submitButton = bookingForm.querySelector('[type="submit"]');
    submitButton.disabled = true;
    toastMessage.textContent = "Отправляем заявку на сервер…";
    toast.classList.add("is-visible");
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Не удалось сохранить заявку.");
      const roomRu = ({"Classic Double":"Классический двухместный","Deluxe King":"Делюкс с кроватью King","City Suite":"Городской люкс"})[request.room] || request.room;
      const nightsRu = nights === 1 ? "ночь" : (nights >= 2 && nights <= 4 ? "ночи" : "ночей");
      toast.querySelector("strong").textContent = "Заявка сохранена!";
      toastMessage.textContent = `${request.name}, заявка на номер «${roomRu}» на ${nights} ${nightsRu} (${money(request.total)}) сохранена в базе данных. Это запрос, а не подтверждённое бронирование; оплата не проводится.`;
      bookingForm.reset();
      checkin.value = localDateString(tomorrow);
      checkout.value = localDateString(dayAfter);
      updateSummary();
    } catch (error) {
      toast.querySelector("strong").textContent = "Не удалось отправить";
      toastMessage.textContent = `${error.message} Убедитесь, что приложение запущено через сервер Docker.`;
    } finally {
      submitButton.disabled = false;
    }
    toast.classList.add("is-visible");
    toastClose.focus({ preventScroll: true });
  });

  toastClose?.addEventListener("click", () => toast.classList.remove("is-visible"));
  updateSummary();
})();