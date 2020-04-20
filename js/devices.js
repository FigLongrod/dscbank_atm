import { Tools,Sounds } from "/js/tools.js";

export class ATMCashReader {
  constructor(atm) {
    this.atm = atm;
    this.notes = [];
    this.locked = false;
  }
  lock() {
    this.locked = true;
  }
  count() {
    return this.notes.reduce((total, val) => (total += parseInt(val, 10)));
  }
  unlock(consume) {
    if (consume) {
      this.atm.dispenser.add(this.notes);
      this.notes.length = 0;
    }
  }
  add(note) {
    if (this.locked) {
      return;
    }
    this.notes.push(note);
  }
}

export class ATMCashDispenser {
  constructor(element, stock) {
    this.element = element;
    this.notes = stock || {
      "100": 50,
      "50": 100,
      "20": 200,
      "5": 200,
      "2": 7,
      "1": 1000
    };
  }
  dispenseNote(note) {
    return new Promise(resolve => {
      let noteDiv = document.createElement('div');
      noteDiv.className = "note note-" + note;
      this.element.appendChild(noteDiv);
      setTimeout(resolve, 250);
    });
  }
  dispense(amount) {
    return new Promise((resolve, reject) => {
      let amountDispensed = 0;
      let amountRemaining = amount;
      let notes = ["1", "2", "5", "20", "50", "100"];
      while (notes.length > 0 && amountRemaining > 0) {
        let note = notes.pop();
        let value = parseInt(note, 10);
        while (amountRemaining >= value && this.notes[note] > 0) {
          this.dispenseNote(note).then(() => {
            amountDispensed += value;
            amountRemaining -= value;
            this.notes[note]--;           
          });
        }
      }
      if (amountRemaining <= 0) {
        resolve();
      } else {
        reject(amountDispensed);
      }
    });
  }
  add(notes) {
    notes.forEach(note => {
      this.notes[note]++;
    });
  }
}

export class ATMCardReader {
  constructor(element) {
    this.element = element;
    this.green = Array.from(element.children).filter(
      c => c.className == "green"
    )[0];
    this.red = Array.from(element.children).filter(
      c => c.className == "red"
    )[0];
    this.sound = document.createElement("AUDIO");
    this.element.style.cursor = "not-allowed";
    this.hasCard = false;
    this.card = null;
    this.locked = false;
  }
  waitForCard() {
    return new Promise(resolve => {
      let handle = setInterval(() => {
        if (this.hasCard) {
          clearInterval(handle);
          this.red.style.display = "none";
          this.green.style.display = "block";
          Tools.play(
            "https://cdn.glitch.com/963c8400-ea6c-4228-9a4d-5f0266e4f1ff%2Fatm-card-sound.mp3?v=1587296440314"
          ).then(() => resolve(this.card.cardNumber));
        }
      }, 10);
    })
    
  }
  insertCard(card) {
    if (!this.hasCard) {
      this.card = card;
      this.hasCard = true;
      this.locked = true;      
      document.dispatchEvent(new CustomEvent("remove-card", {detail: this.card }));
    }
  }
  ejectCard() {
    this.locked = false;
    this.element.style.cursor = "pointer";
    let handle = Tools.addEventHandler(this.element, "click", () => {
      this.element.style.cursor = "not-allowed";
      document.dispatchEvent(new CustomEvent("add-card", {detail: this.card }));
      this.card = null;
      this.hasCard = false;
      this.locked = false;
      Tools.removeEventHandler(handle);
    }, this);
  }
  waitForTakeCard() {
    return new Promise(resolve => {
      let handle = setInterval(() => {
        if (!this.hasCard) {
          clearInterval(handle);
          this.red.style.display = "block";
          this.green.style.display = "none";
          Tools.play(
            "https://cdn.glitch.com/963c8400-ea6c-4228-9a4d-5f0266e4f1ff%2Fatm-card-sound.mp3?v=1587296440314").then(resolve);
        }
      }, 10);
    });
  }
  captureCard() {
    this.card = null;
    this.hasCard = false;
    this.locked = false;
  }
}

export class ATMPinReader {
  constructor(element) {
    this.element = element;
    this.span = Array.from(element.children).filter(
      c => c.className == "pin"
    )[0];
    this.pin = "";
    this.span.innerHTML = "";
  }
  waitForPIN() {
    this.pin = "";
    this.span.innerHTML = "";
    this.option = "none";
    return new Promise((resolve, reject) => {
      let handler = Tools.addEventHandler(
        document,
        "keyup",
        e => {
          if (e.keyCode >= 48 && e.keyCode <= 57) {
            this.pin += "" + e.keyCode - 48;
            this.span.innerHTML += "*";
            Tools.play(
              "https://cdn.glitch.com/963c8400-ea6c-4228-9a4d-5f0266e4f1ff%2Fatm-button-sound.mp3?v=1587297187955"
            );
          } else if (e.keyCode >= 96 && e.keyCode <= 105) {
            this.pin += "" + e.keyCode - 96;
            this.span.innerHTML += "*";
            Tools.play(
              "https://cdn.glitch.com/963c8400-ea6c-4228-9a4d-5f0266e4f1ff%2Fatm-button-sound.mp3?v=1587297187955"
            );
          } else if (e.keyCode == 13) {
            this.span.innerHTML = "";
            Tools.removeEventHandler(handler);
            resolve(this.pin);
          } else if (e.keyCode == 27) {
            this.span.innerHTML = "";
            this.pin = "";
            Tools.removeEventHandler(handler);
            reject();
          }
        },
        this
      );
    });
  }
}

export class ATMReceiptPrinter {
  print(lines) {}
}

// define a simple 80x25 console screen
export class ATMConsole {
  constructor(element) {
    this.element = element;
    this.height = 40;
    this.width = 100;
    this.init();
  }
  init() {
    this.clear();
  }
  scrollUp() {
    this.element.deleteRow(0);
    let row = this.element.insertRow();
    for (let j = 0; j < this.width; j++) {
      row.insertCell();
    }
  }
  clear() {
    this.element.innerHTML = "";
    for (let i = 0; i < this.height; i++) {
      let row = this.element.insertRow();
      for (let j = 0; j < this.width; j++) {
        row.insertCell();
      }
    }
    this.currentLine = 0;
    this.currentColumn = 0;
  }
  moveTo(x, y) {
    this.currentColumn = x >= this.width ? this.width - 1 : x;
    this.currentLine = y >= this.height ? this.height - 1 : y;
  }
  writeChar(char, advance) {
    if (char === "`") {
      this.currentLine++;
      this.currentColumn = 0;
      return;
    }
    let cell = null;
    try {
      cell = this.element.rows[this.currentLine].cells[this.currentColumn];
    } catch {
      cell = null;
    }
    if (cell) {
      cell.innerHTML = char;
      Tools.play(Sounds.console, 0.2);
      if (advance) {
        this.currentColumn++;
        if (this.currentColumn >= this.width) {
          this.currentColumn = 0;
          if (this.currentLine >= this.height - 1) {
            this.scrollUp();
          } else {
            this.currentLine++;
          }
        }
      }
    }
  }
  appendText(line) {
    return new Promise((resolve, reject) => {
      let chars = Array.from(line);
      chars.reverse();
      let handle = setInterval(() => {
        if (chars.length < 1) {
          resolve();
          clearInterval(handle);
        } else {
          this.writeChar(chars.pop(), true);
        }
      }, 10);
    });
  }
  appendLines(lines) {
    return this.appendText(lines.join("`"));
  }
  display(lines) {
    this.clear();
    return this.appendLines(lines);
  }
}
