import { createRequest } from "./requests.js";
import { normalizePhone } from "./registration-rules.js";

function connect(form, type) {
  const phone = form.elements.contactPhone || form.elements.phone;
  const submit = form.querySelector('[type="submit"]');
  const error = document.createElement("p");
  error.className = "auth-error"; error.setAttribute("aria-live", "polite");
  phone.insertAdjacentElement("afterend", error);
  let status = form.querySelector('[role="status"]');
  if (!status) { status = document.createElement("p"); status.setAttribute("role", "status"); form.append(status); }
  phone.addEventListener("input", () => { error.textContent = ""; phone.removeAttribute("aria-invalid"); status.textContent = ""; });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submit.disabled) return;
    if (!normalizePhone(phone.value)) {
      error.textContent = "Введите номер РБ: +375 и ещё 9 цифр.";
      phone.setAttribute("aria-invalid", "true"); phone.focus(); return;
    }
    if (!form.reportValidity()) return;
    submit.disabled = true; status.textContent = "Сохраняем заявку…";
    try {
      await createRequest(type, Object.fromEntries(new FormData(form)));
      form.reset(); status.textContent = "Учебная заявка сохранена и доступна менеджеру.";
    } catch (failure) { status.textContent = failure.message; }
    finally { submit.disabled = false; }
  });
}
document.querySelectorAll(".corporate-form").forEach((form) => connect(form, "corporate"));
document.querySelectorAll(".contact__form").forEach((form) => connect(form, "question"));
