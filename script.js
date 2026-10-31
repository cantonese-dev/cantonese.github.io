const menuToggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('#nav-links');
menuToggle.addEventListener('click', () => {
  const isOpen = nav.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', isOpen);
});
nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => nav.classList.remove('open')));

const checks = [...document.querySelectorAll('.routine-item input')];
const progressFill = document.querySelector('#progress-fill');
const progressLabel = document.querySelector('#progress-label');
const streakCount = document.querySelector('#streak-count');
function updateProgress() {
  const done = checks.filter((check) => check.checked).length;
  progressFill.style.width = `${(done / checks.length) * 100}%`;
  progressLabel.textContent = `${done} / ${checks.length} COMPLETE`;
  streakCount.textContent = done === checks.length ? '1 DAY' : '0 DAYS';
}
checks.forEach((check) => check.addEventListener('change', updateProgress));

const phrases = [
  { english: 'How are you?', jyutping: 'nei5 hou2 maa3?', canto: '你 好 嗎？' },
  { english: 'That’s delicious!', jyutping: 'hou2 sik6 aa3!', canto: '好 食 啊！' },
  { english: 'How much is it?', jyutping: 'gei2 cin2 aa3?', canto: '幾 錢 啊？' },
  { english: 'I’m learning Cantonese.', jyutping: 'ngo5 hok6 gan2 Gwong2 dung1 waa2.', canto: '我 學 緊 廣 東 話。' },
];
let phraseIndex = 0;
const flashcard = document.querySelector('#flashcard');
document.querySelector('#next-phrase').addEventListener('click', () => {
  phraseIndex = (phraseIndex + 1) % phrases.length;
  const phrase = phrases[phraseIndex];
  document.querySelector('#phrase-english').textContent = phrase.english;
  document.querySelector('#phrase-jyutping').textContent = phrase.jyutping;
  document.querySelector('#phrase-canto').textContent = phrase.canto;
  flashcard.classList.remove('flipped');
});
flashcard.addEventListener('click', () => flashcard.classList.toggle('flipped'));

const themeToggle = document.querySelector('#theme-toggle');
const themeIcon = themeToggle.querySelector('.theme-icon');
const themeLabel = themeToggle.querySelector('.theme-label');
const savedTheme = localStorage.getItem('cantonese-theme');
function setTheme(theme) {
  const isDark = theme === 'dark';
  document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  themeToggle.setAttribute('aria-pressed', isDark);
  themeToggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
  themeIcon.textContent = isDark ? '☾' : '☼';
  themeLabel.textContent = isDark ? 'DARK' : 'LIGHT';
  document.querySelector('meta[name="theme-color"]').setAttribute('content', isDark ? '#151a19' : '#f5ead7');
}
setTheme(savedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
themeToggle.addEventListener('click', () => {
  const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  setTheme(nextTheme);
  localStorage.setItem('cantonese-theme', nextTheme);
});
