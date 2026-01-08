
const slides = [
  {
    img: "assets/img/one.jpg",
    title: "One Platform for <br>Dte of CNPF",
    text: "Secure control of land assets, tenants, finances, and revenue collection"
  },
  {
    img: "assets/img/two.jpg",
    title: "Digital Control<br> of Land Assets",
    text: "Structured management of contracts, tenants, rentals, and government share"
  },
  {
    img: "assets/img/three.jpg",
    title: "Sustainable<br>Land Planning",
    text: "Support growth while protecting natural resources"
  }
];

let index = 0;
const topBg = document.querySelector('.bg.top');
const bottomBg = document.querySelector('.bg.bottom');

bottomBg.style.backgroundImage = `url(${slides[0].img})`;

function changeBackground() {
  const slide = slides[index];

  topBg.style.backgroundImage = `url(${slide.img})`;
  topBg.style.opacity = 1;

  bgTitle.innerHTML = slide.title;
  bgText.innerText = slide.text;

  setTimeout(() => {
    bottomBg.style.backgroundImage = topBg.style.backgroundImage;
    topBg.style.opacity = 0;
  }, 1200);

  index = (index + 1) % slides.length;
}

setInterval(changeBackground, 4000);
