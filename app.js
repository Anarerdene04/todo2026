const STORAGE_KEY = "todo-web-items";
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const state = {
  cursor: startOfDay(new Date()),
  view: "month",
  selected: null,
  editingId: null,
  saveError: "",
  todos: loadTodos(),
};

const board = document.querySelector("#board");
const dialog = document.querySelector("#dayDialog");
const periodLabel = document.querySelector("#periodLabel");
const periodMeta = document.querySelector("#periodMeta");
const prevBtn = document.querySelector("#prevBtn");
const nextBtn = document.querySelector("#nextBtn");

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, amount) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

function addMonths(date, amount) {
  const day = date.getDate();
  const next = new Date(date.getFullYear(), date.getMonth() + amount, 1);
  const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, last));
  return next;
}

function startOfWeek(date) {
  return addDays(startOfDay(date), -date.getDay());
}

function formatKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function parseKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatFull(date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function formatRange(start, end) {
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return `${start.getFullYear()}년 ${start.getMonth() + 1}월 ${start.getDate()}일 – ${end.getDate()}일`;
  }
  if (start.getFullYear() === end.getFullYear()) {
    return `${start.getMonth() + 1}월 ${start.getDate()}일 – ${end.getMonth() + 1}월 ${end.getDate()}일`;
  }
  return `${formatFull(start)} – ${formatFull(end)}`;
}

function sameDay(a, b) {
  return formatKey(a) === formatKey(b);
}

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadTodos() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.id === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.date) && typeof item.text === "string")
      .map((item) => ({
        id: item.id,
        date: item.date,
        text: item.text.slice(0, 120),
        done: Boolean(item.done),
        createdAt: Number(item.createdAt) || 0,
      }));
  } catch {
    return [];
  }
}

function saveTodos() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.todos));
    state.saveError = "";
  } catch {
    state.saveError = "저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.";
  }
}

function todosFor(dateKey) {
  return state.todos
    .filter((item) => item.date === dateKey)
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}

function todosBetween(start, end) {
  const from = formatKey(start);
  const to = formatKey(end);
  return state.todos.filter((item) => item.date >= from && item.date <= to);
}

function summary(items) {
  if (items.length === 0) return "할 일 없음";
  const left = items.filter((item) => !item.done).length;
  return `할 일 ${items.length}개 · 남음 ${left}개`;
}

function visibleRange() {
  if (state.view === "day") {
    return { start: state.cursor, end: state.cursor, label: `${formatFull(state.cursor)} ${WEEKDAYS[state.cursor.getDay()]}요일` };
  }
  if (state.view === "week") {
    const start = startOfWeek(state.cursor);
    const end = addDays(start, 6);
    return { start, end, label: formatRange(start, end) };
  }
  const start = new Date(state.cursor.getFullYear(), state.cursor.getMonth(), 1);
  const end = new Date(state.cursor.getFullYear(), state.cursor.getMonth() + 1, 0);
  return { start, end, label: `${start.getFullYear()}년 ${start.getMonth() + 1}월` };
}

function agendaHtml(dateKey) {
  const items = todosFor(dateKey);
  const rows = items.map((item) => {
    const done = item.done ? "is-done" : "";
    const checkLabel = item.done ? "완료 해제" : "완료";
    if (state.editingId === item.id) {
      return `
        <li class="item ${done}">
          <form class="edit-form" data-action="save" data-id="${esc(item.id)}">
            <input class="edit-input" name="text" type="text" maxlength="120" value="${esc(item.text)}" aria-label="할 일 내용" required>
            <button class="btn btn-primary" type="submit">저장</button>
            <button class="btn btn-ghost" type="button" data-action="cancel-edit">취소</button>
          </form>
        </li>`;
    }
    return `
      <li class="item ${done}">
        <label class="check">
          <input type="checkbox" data-action="toggle" data-id="${esc(item.id)}" ${item.done ? "checked" : ""}>
          <span class="sr-only">${checkLabel}</span>
        </label>
        <p class="item-text">${esc(item.text)}</p>
        <button class="btn btn-quiet" type="button" data-action="edit" data-id="${esc(item.id)}">수정</button>
        <button class="btn btn-danger" type="button" data-action="delete" data-id="${esc(item.id)}" aria-label="삭제: ${esc(item.text)}">삭제</button>
      </li>`;
  }).join("");

  const empty = items.length ? "" : `<p class="empty">이 날짜의 할 일이 없습니다. 아래에서 추가하세요.</p>`;
  return `
    <p class="count">${summary(items)}</p>
    <ul class="agenda-list">${rows}</ul>
    ${empty}
    <form class="add-form" data-action="add" data-date="${esc(dateKey)}">
      <input class="add-input" name="text" type="text" maxlength="120" placeholder="새 할 일" aria-label="새 할 일" autocomplete="off">
      <button class="btn btn-primary" type="submit">추가</button>
    </form>`;
}

function renderChrome() {
  const range = visibleRange();
  periodLabel.textContent = range.label;
  periodMeta.textContent = state.saveError || summary(todosBetween(range.start, range.end));
  document.title = `할 일 · ${range.label}`;

  const navText = state.view === "month" ? ["이전 달", "다음 달"] : state.view === "week" ? ["이전 주", "다음 주"] : ["이전 날", "다음 날"];
  prevBtn.setAttribute("aria-label", navText[0]);
  nextBtn.setAttribute("aria-label", navText[1]);

  document.querySelectorAll("[data-action='set-view']").forEach((button) => {
    const active = button.dataset.view === state.view;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function monthHtml() {
  const dows = WEEKDAYS.map((name, index) => {
    const tone = index === 0 ? "tone-sun" : index === 6 ? "tone-sat" : "";
    return `<div class="dow ${tone}">${name}</div>`;
  }).join("");

  const first = new Date(state.cursor.getFullYear(), state.cursor.getMonth(), 1);
  const last = new Date(state.cursor.getFullYear(), state.cursor.getMonth() + 1, 0);
  const gridStart = startOfWeek(first);
  const gridEnd = addDays(startOfWeek(last), 6);
  const today = startOfDay(new Date());
  let cells = "";

  for (let date = gridStart; date.getTime() <= gridEnd.getTime(); date = addDays(date, 1)) {
    const key = formatKey(date);
    const items = todosFor(key);
    const outside = date.getMonth() !== state.cursor.getMonth();
    const weekend = date.getDay() === 0 ? "tone-sun" : date.getDay() === 6 ? "tone-sat" : "";
    const previews = items.slice(0, 3).map((item) => `<li class="preview ${item.done ? "is-done" : ""}">${esc(item.text)}</li>`).join("");
    const extra = items.length > 3 ? `<li class="more">+${items.length - 3}</li>` : "";
    const dots = items.slice(0, 4).map((item) => `<span class="dot ${item.done ? "is-done" : ""}"></span>`).join("");
    cells += `
      <div
        class="day ${outside ? "is-out" : ""} ${sameDay(date, today) ? "is-today" : ""} ${state.selected === key ? "is-selected" : ""}"
        role="button"
        tabindex="0"
        data-action="open"
        data-date="${key}"
        aria-label="${date.getMonth() + 1}월 ${date.getDate()}일, 할 일 ${items.length}개"
        ${sameDay(date, today) ? 'aria-current="date"' : ""}
      >
        <span class="num ${weekend}" aria-hidden="true">${date.getDate()}</span>
        <ul class="preview-list" aria-hidden="true">${previews}${extra}</ul>
        <span class="dots" aria-hidden="true">${dots}</span>
      </div>`;
  }

  return `<div class="month">${dows}${cells}</div>`;
}

function weekHtml() {
  const start = startOfWeek(state.cursor);
  const today = startOfDay(new Date());
  const columns = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(start, index);
    const key = formatKey(date);
    const items = todosFor(key);
    const chips = items.map((item) => `
      <button type="button" class="chip ${item.done ? "is-done" : ""}" data-action="open" data-date="${key}" data-edit="${esc(item.id)}">${esc(item.text)}</button>
    `).join("");
    const weekend = date.getDay() === 0 ? "tone-sun" : date.getDay() === 6 ? "tone-sat" : "";
    return `
      <section class="week-col ${sameDay(date, today) ? "is-today" : ""} ${state.selected === key ? "is-selected" : ""}">
        <button type="button" class="week-head" data-action="open" data-date="${key}" aria-label="${formatFull(date)} 열기">
          <span class="${weekend}">${WEEKDAYS[date.getDay()]}요일</span>
          <strong class="${weekend}">${date.getDate()}</strong>
        </button>
        <div class="week-items">${chips || `<p class="empty">없음</p>`}</div>
        <button type="button" class="week-add" data-action="open" data-date="${key}">추가</button>
      </section>`;
  }).join("");
  return `<div class="week-scroll"><div class="week">${columns}</div></div>`;
}

function dayHtml() {
  const date = state.cursor;
  const key = formatKey(date);
  return `
    <section class="day-view">
      <div class="day-hero">
        <p class="day-kicker">${date.getFullYear()}년 ${date.getMonth() + 1}월</p>
        <p class="day-num ${date.getDay() === 0 ? "tone-sun" : date.getDay() === 6 ? "tone-sat" : ""}">${date.getDate()}</p>
        <p class="day-week">${WEEKDAYS[date.getDay()]}요일</p>
      </div>
      <div class="paper agenda">
        <div class="agenda-head">
          <h3>이 날의 할 일</h3>
        </div>
        ${agendaHtml(key)}
      </div>
    </section>`;
}

function renderBoard() {
  if (state.view === "day") board.innerHTML = dayHtml();
  else if (state.view === "week") board.innerHTML = weekHtml();
  else board.innerHTML = monthHtml();
}

function renderDialog() {
  if (!state.selected) return;
  const date = parseKey(state.selected);
  dialog.innerHTML = `
    <div class="dialog-card">
      <div class="agenda-head">
        <div>
          <p class="eyebrow">${WEEKDAYS[date.getDay()]}요일</p>
          <h3 id="dialogTitle">${formatFull(date)}</h3>
        </div>
        <button type="button" class="close-btn" data-action="close" aria-label="닫기">×</button>
      </div>
      ${agendaHtml(state.selected)}
    </div>`;
}

function focusEditor(kind) {
  const root = dialog.open ? dialog : board;
  const field = root.querySelector(kind === "edit" ? ".edit-input" : ".add-input");
  if (!field) return;
  field.focus();
  const end = field.value.length;
  field.setSelectionRange(end, end);
}

function refresh(options = {}) {
  const scrollTop = dialog.open ? dialog.scrollTop : 0;
  renderChrome();
  renderBoard();
  if (dialog.open) {
    renderDialog();
    dialog.scrollTop = scrollTop;
  }
  if (options.focus) focusEditor(options.focus);
}

function openDate(dateKey, editId = null) {
  state.selected = dateKey;
  state.editingId = editId;
  if (state.view === "day") {
    state.cursor = parseKey(dateKey);
    refresh({ focus: editId ? "edit" : "add" });
    return;
  }
  const wasOpen = dialog.open;
  renderChrome();
  renderBoard();
  renderDialog();
  if (!wasOpen) dialog.showModal();
  focusEditor(editId ? "edit" : "add");
}

function setView(view) {
  if (!["day", "week", "month"].includes(view) || view === state.view) return;
  if ((view === "day" || view === "week") && state.selected) {
    state.cursor = parseKey(state.selected);
  }
  state.view = view;
  state.editingId = null;
  if (view === "day" && dialog.open) {
    dialog.close();
    return;
  }
  refresh();
}

function navigate(direction) {
  if (state.view === "month") state.cursor = addMonths(state.cursor, direction);
  else if (state.view === "week") state.cursor = addDays(state.cursor, direction * 7);
  else state.cursor = addDays(state.cursor, direction);

  if (state.view === "day") state.selected = formatKey(state.cursor);
  refresh();
}

function goToday() {
  state.cursor = startOfDay(new Date());
  state.selected = formatKey(state.cursor);
  state.editingId = null;
  if (state.view === "day") {
    refresh({ focus: "add" });
    return;
  }
  refresh();
}

function addTodo(dateKey, text, input) {
  const value = text.trim();
  if (!value) {
    input?.classList.add("is-invalid");
    input?.focus();
    return;
  }
  state.todos.push({
    id: uid(),
    date: dateKey,
    text: value.slice(0, 120),
    done: false,
    createdAt: Date.now(),
  });
  state.selected = dateKey;
  state.editingId = null;
  saveTodos();
  refresh({ focus: "add" });
}

function saveTodo(id, text, input) {
  const item = state.todos.find((todo) => todo.id === id);
  const value = text.trim();
  if (!item) return;
  if (!value) {
    input?.classList.add("is-invalid");
    input?.focus();
    return;
  }
  item.text = value.slice(0, 120);
  state.editingId = null;
  saveTodos();
  refresh();
}

function toggleTodo(id) {
  const item = state.todos.find((todo) => todo.id === id);
  if (!item) return;
  item.done = !item.done;
  saveTodos();
  refresh();
}

function deleteTodo(id) {
  state.todos = state.todos.filter((todo) => todo.id !== id);
  if (state.editingId === id) state.editingId = null;
  saveTodos();
  refresh();
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button || button.matches("input")) return;
  const { action, date, view, id } = button.dataset;

  if (action === "prev") navigate(-1);
  else if (action === "next") navigate(1);
  else if (action === "today") goToday();
  else if (action === "set-view") setView(view);
  else if (action === "open") openDate(date, button.dataset.edit || null);
  else if (action === "close") dialog.close();
  else if (action === "edit") {
    state.editingId = id;
    refresh({ focus: "edit" });
  } else if (action === "cancel-edit") {
    state.editingId = null;
    refresh();
  } else if (action === "delete") deleteTodo(id);
});

document.addEventListener("change", (event) => {
  const input = event.target;
  if (input.dataset?.action === "toggle") toggleTodo(input.dataset.id);
});

document.addEventListener("submit", (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || !form.dataset.action) return;
  event.preventDefault();
  const text = form.elements.text?.value || "";
  const field = form.elements.text;
  if (form.dataset.action === "add") addTodo(form.dataset.date, text, field);
  if (form.dataset.action === "save") saveTodo(form.dataset.id, text, field);
});

document.addEventListener("input", (event) => {
  if (event.target.matches("input[type='text']")) event.target.classList.remove("is-invalid");
});

dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});

dialog.addEventListener("cancel", (event) => {
  if (!state.editingId) return;
  event.preventDefault();
  state.editingId = null;
  refresh();
});

dialog.addEventListener("close", () => {
  state.editingId = null;
  renderChrome();
  renderBoard();
});

document.addEventListener("keydown", (event) => {
  if (event.target.matches("input, textarea")) return;
  if ((event.key === "Enter" || event.key === " ") && event.target.matches(".day[data-action='open']")) {
    event.preventDefault();
    openDate(event.target.dataset.date);
    return;
  }
  if (dialog.open) return;
  if (event.key === "ArrowLeft") navigate(-1);
  if (event.key === "ArrowRight") navigate(1);
});

renderChrome();
renderBoard();
