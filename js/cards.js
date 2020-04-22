import { Tools } from "./tools.js";

export class Cards {
  constructor(element, cardreader) {
    this.element = element;
    this.cardreader = cardreader;
    this.cards = [];
    Tools.addEventHandler(document, "add-card", e => {
      this.cards.push(e.detail);
      this.draw();
    })
    Tools.addEventHandler(document, "remove-card", e => {
      let index = this.cards.indexOf(e.detail);
      if (index >= 0) {
        this.cards.splice(index, 1);
        this.draw();
      }
    })
  }
  init() {
    return new Promise((resolve, reject) => {
      Tools.fetchJSONFile("json/accounts.json").then(data => {
        this.cards = data.map(m => ({
          id: m.id,
          name: m.title + " " + m.firstName + " " + m.lastName,
          cardNumber: m.cardNumber
        }));
        Tools.addEventHandler(document, "capture", e => {
          let card = this.cards.filter(c => c.cardNumber == e.detail);
          if (card.length > 0) {
            let element = document.getElementById("card-" + card[0].id);
            element.parentNode.removeChild(element);
          }
        });
        resolve(this);
      }, reject);
    });
  }
  draw() {
    this.element.innerHTML = "";
    this.cards.forEach((c,i) => {
      let card = document.createElement("div");
      card.className = "card";
      card.id = "card-" + c.id;
      card.style.zIndex = i + 2;
      card.style.top = `${20 * i}px`;
      card.style.transform = `translate(${(Math.random() * 10) - 5}px,${(Math.random() * 10) - 5}px) rotation(${(Math.random() * 10) - 5}deg)`;
      card.innerHTML =
        `<img class='card-logo' src='media/images/daytona.gif'/><h3>${c.cardNumber}</h3><h4>${c.name}</h4>`;
      this.element.appendChild(card);
      Tools.addEventHandler(
        document.getElementById(card.id),
        "click",
        () => {          
          this.cardreader.insertCard(c);
        },
        this
      );
    });
  }
}
