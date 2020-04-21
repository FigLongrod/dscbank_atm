import { Tools, Sounds } from "./tools.js";

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
      "10": 100,
      "5": 200,
      "2": 7,
      "1": 1000
    };
  }
  dispenseNote(note) {
    return new Promise(resolve => {
      console.log(`Dispensing a $${note} note`);
      let noteDiv = document.createElement('div');
      noteDiv.className = "note note-" + note;
      this.element.appendChild(noteDiv);
      setTimeout(resolve, 250);
    });
  }
  issueNotes(amountRemaining, note) {
    let val = parseInt(note, 10)
    console.log(`Dispensing $${note} notes up to ${amountRemaining}`);
    return new Promise(resolve => {
      if (this.notes[note] > 0 && amountRemaining >= val) {
        this.dispenseNote(note).then(() => {
          amountRemaining -= val;
          if (amountRemaining >= val) {
            this.issueNotes(amountRemaining, note).then(remaining => resolve(remaining));
          } else {
            resolve(amountRemaining);
          }
        });
      } else {
        resolve(amountRemaining);
      }
    });
  }
  dispense(amount) {
    console.log(`Dispensing notes up to ${amount}`)
    return new Promise((resolve, reject) => {
      this.issueNotes(amount, "100")
        .then(remaining => this.issueNotes(remaining, "50")
          .then(remaining => this.issueNotes(remaining, "20")
            .then(remaining => this.issueNotes(remaining, "10")
              .then(remaining => this.issueNotes(remaining, "5")
                .then(remaining => this.issueNotes(remaining, "2")
                  .then(remaining => this.issueNotes(remaining, "1")
                    .then(remaining => {
                      if (remaining > 0) {
                        reject(remaining);
                      } else {
                        resolve();
                      }
                    })))))));
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
  async waitForCard() {
    return await new Promise(resolve => {
      let handle = setInterval(() => {
        if (this.hasCard) {
          clearInterval(handle);
          this.red.style.display = "none";
          this.green.style.display = "block";
          await Tools.play(Sounds.pinbutton);
          return this.card.cardNumber;
        }
      }, 10);
    })
  }
  async insertCard(card) {
    if (!this.hasCard) {
      this.card = card;
      this.hasCard = true;
      this.locked = true;
      document.dispatchEvent(new CustomEvent("remove-card", { detail: this.card }));
      await Tools.play(Sounds.cardreader);
    }
  }
  async ejectCard() {
    this.locked = false;
    this.element.style.cursor = "pointer";
    await Tools.play(Sounds.pinbutton);
    let handle = Tools.addEventHandler(this.element, "click", () => {
      this.element.style.cursor = "not-allowed";
      document.dispatchEvent(new CustomEvent("add-card", { detail: this.card }));
      this.card = null;
      this.hasCard = false;
      this.locked = false;
      Tools.removeEventHandler(handle);
    }, this);
  }
  async waitForTakeCard() {
    await new Promise(resolve => {
      let handle = setInterval(() => {
        if (!this.hasCard) {
          clearInterval(handle);
          this.red.style.display = "block";
          this.green.style.display = "none";
          await Tools.play(Sounds.cardreader);
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
  async waitForPIN() {
    this.pin = "";
    this.span.innerHTML = "";
    this.option = "none";

    return await new Promise((resolve, reject) => {
      let handler = Tools.addEventHandler(
        document,
        "keyup",
        e => {
          if (e.keyCode >= 48 && e.keyCode <= 57) {
            this.pin += "" + e.keyCode - 48;
            this.span.innerHTML += "*";
            Tools.play(Sounds.pinbutton);
          } else if (e.keyCode >= 96 && e.keyCode <= 105) {
            this.pin += "" + e.keyCode - 96;
            this.span.innerHTML += "*";
            Tools.play(Sounds.pinbutton);
          } else if (e.keyCode == 13) {
            this.span.innerHTML = "";
            Tools.removeEventHandler(handler);
            resolve(this.pin);
          } else if (e.keyCode == 27) {
            this.span.innerHTML = "";
            this.pin = "";
            Tools.removeEventHandler(handler);
            reject("Canceled.");
          }
        },
        this
      );
    });
  }
}

export class ATMReceiptPrinter {
  print(lines) { }
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
    console.log("ATM screen scrolling up");
    this.element.deleteRow(0);
    let row = this.element.insertRow();
    for (let j = 0; j < this.width; j++) {
      row.insertCell();
    }
    this.currentColumn = 0;
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
      if (this.currentLine >= this.height - 1) {
        this.scrollUp();
      } else {
        this.currentLine++;
        this.currentColumn = 0;
      }
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
  async appendText(line) {
    await new Promise(resolve => {
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
    })
  }
  async appendLines(lines) {
    if (Array.isArray(lines)) {
      await this.appendText(lines.join('`'))
    } else {
      await this.appendText(arguments.length > 1 ? Array.from(arguments).join('`') : lines);
    }
  }
  async display() {
    this.clear();
    await this.appendLines(Array.from(arguments));
  }
}
