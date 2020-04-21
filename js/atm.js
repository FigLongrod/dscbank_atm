import {
  ATMConsole,
  ATMCashDispenser,
  ATMCardReader,
  ATMCashReader,
  ATMPinReader
} from "./devices.js";
import { FinancialHost } from "./host.js";
import { Tools, Sounds } from "./tools.js";

let art = [
  "Initializing...",
  "",
  "System Start Up - RobTech Bios 1.2",
  "",
  "                     ______",
  "                    /     /\\",
  "                   /     /##\\",
  "                  /     /####\\             FigOS v9.53 - Welcome to Figland",
  "                 /     /######\\",
  "                /     /########\\",
  "               /     /##########\\          initfs.startup....             [OKAY]",
  "              /     /#####/######\\         bringing up flux capacitor...  [OKAY]",
  "             /     /#####/++######\\        near-solar satellite online... [OKAY]",
  "            /     /#####/++++######\\       splining paths...              [OKAY]",
  "           /     /#####/+++++#######\\      pathing splines...             [FAIL]",
  "          /     /#####/  +++++#######\\",
  "         /     /#####/    +++++#######\\    non-critical error, corruption at 5%",
  "        /     /#####/      +++++#######\\   resuming...",
  "       /     /#####/        +++++#######\\",
  "      /     /#####/__________+++++#######\\",
  "     /                        +++++#######\\",
  "    /__________________________+++++######/",
  "    +++++++++++++++++++++++++++++++++####/",
  "     +++++++++++++++++++++++++++++++++##/",
  "      +++++++++++++++++++++++++++++++++/",
  "      ``````````````````````````````````",
  "",
  ""
];

export class ATM {
  constructor(consoleElement, cardreaderElement, pinreaderElement, dispenserElement) {
    console.log("Manufacturing new ATM");
    this.console = new ATMConsole(consoleElement);
    this.dispenser = new ATMCashDispenser(dispenserElement);
    this.cardreader = new ATMCardReader(cardreaderElement);
    this.reader = new ATMCashReader();
    this.pinreader = new ATMPinReader(pinreaderElement);
    this.id = 715;
    this.host = new FinancialHost();
    this.session = null;
    //Tools.play(Sounds.startup).then(() => this.console.appendLines(art).then(() => this.host.init().then(() => this.waitForCard())));
    Tools.play(Sounds.startup).then(() => this.host.init().then(() => this.waitForCard()));
  }
  async callAPI(call, payload) {
    let requestId = new Date().getTime();
    payload.call = call;
    let request = {
      system: {
        session_id: this.session ? this.session.session_id : null,
        request_id: requestId,
        terminal_id: 715
      },
      request: payload
    };
    return await this.host.api(request);
  }
  async readAmount(prompt) {
    await this.console.appendLines(["", prompt]);
    return await new Promise(resolve => {
      let input = "";
      let handle = Tools.addEventHandler(
        document,
        "keyup",
        e => {
          let val = Number(e.key);
          if (val >= 0 && val <= 9) {
            input += val;
            this.console.writeChar(val, true);
          } else if (e.keyCode == 13) {
            Tools.removeEventHandler(handle);
            resolve(input);
          } else {
            Tools.play(Sounds.error);
          }
        },
        this
      );
    });
  }
  async readKey(prompt, set, cancel) {
    await this.console.appendLines(["", prompt]);
    return await new Promise(resolve => {
      let handle = Tools.addEventHandler(
        document,
        "keyup",
        e => {
          if (e.keyCode == 27 && cancel) {
            resolve(e.keyCode);
          }
          else if (set.indexOf(e.key) >= 0) {
            this.console.writeChar(e.key, true);
            Tools.removeEventHandler(handle);
            resolve(e.key);
          } else {
            Tools.play(Sounds.error);
          }
        },
        this
      );
    });
  }
  async getAccountList() {
    try {
      const response = await this.callAPI("listaccountsbytype", { type: "ALL" });
      this.session.accounts = response.response.accounts;
    }
    catch (response) {
      throw "Error: " + (response.response && response.response.error ? response.response.error : response);
    }
  }
  async runEjectCard(reason) {
    await this.console.appendLines(`${reason}\`\``);
    await this.console.appendLines("Ejecting card. Please take your card.")
    await this.cardreader.ejectCard();
    await this.cardreader.waitForTakeCard();
  }
  async runAccountsList() {
    try {
      while (true) {
        await this.getAccountList();
        await this.accountListHeader();
        await this.listAccounts();
        let account = await this.selectAccount();
        await this.runManageAccount(account);
      }
    }
    catch (response) {
      await this.runEjectCard(["", response, ""]);
    }
  }
  async accountListHeader() {
    if (this.session.accounts.length > 0) {
      await this.console.appendLines(`\`You have ${this.session.accounts.length} accounts:\`\``);
    } else {
      throw "You do not have any accessible accounts.";
    }
  }
  async listAccounts() {
    await this.console.appendLines(this.session.accounts.map((a, i) => `${i + 1}: ${a.name} (${a.type}), Balance: ${a.balance.toFixed(2)}, Available: ${a.available.toFixed(2)}`));
  }

  async selectAccount() {
    while (true) {
      let key = await this.readKey(`\`Please select an account to manage (1 - ${this.session.accounts.length}, [ESC] to Cancel): `, this.session.accounts.map((a, i) => (i + 1)).join(""), true);
      if (key == 27) {
        throw "Cancel.";
      } else {
        let num = Number(key);
        if (num > 0 && num <= this.session.accounts.length) {
          await this.console.appendLines(`\`You selected: ${this.session.accounts[num - 1].name}\``);
          return this.session.accounts[num - 1];
        } else {
          Tools.play(Sounds.error);
        }
      }
    }
  }

  // runManageAccount uses the selected account as a basis for executing deposits, withdrawals, and transfers
  async runManageAccount(account) {
    switch (account.type) {
      case "SAVINGS":
        await this.runManageSavings(account);
        break;
      case "CREDIT":
        await this.runManageCredit(account);
        break;
      case "LOAN":
        await this.runManageLoan(account);
        break;
    }
  }
  async runManageSavings(account) {
    let options = [];
    if (account.available > 0) {
      options.push("Cash Withdrawal");
      options.push("Funds Transfer");
    }
    options.push("Cash Deposit");
    if (options.length < 1) {
      this.console
        .appendLines(["", "This account has no viable operations."])
        .then(resolve);
      return;
    }
    let prompt = `Select an operation: ${options.map((o, i) => `[${i + 1}] ${o}`).join(" ")} [ESC] Cancel:`;
    while (true) {
      let key = await this.readKey(prompt, options.map((o, i) => i + 1).join(""), true);
      if (key == 27) {
        await this.console.appendLines("", "Cancel.", "");
        return;
      }
      let num = Number(key);
      if (num > 0 && num <= options.length) {
        switch (options[num - 1]) {
          case "Cash Withdrawal":
            await this.console.appendLines("", `You selected: Cash Withdrawal from ${account.name}`);
            await this.runWithdraw("Cash Withdrawal", account, account.available);
            return;
          case "Funds Transfer":
            await this.console.appendLines("", `You selected: Funds Transfer from ${account.name}`);
            await this.runTransfer("Funds Transfer", account);
            return;
          case "Cash Deposit":
            await this.console.appendLines("", `You selected: Cash Deposit to ${account.name}`);
            await this.runDeposit("Cash Deposit", account);
            return;
          default:
            Tools.play(Sounds.error);
        }
      } else {
        Tools.play(Sounds.error);
      }
    }
  }
  async runManageCredit(account) {
    // return new Promise((resolve, reject) => {
    //   let options = [];
    //   if (account.available > 0) {
    //     options.push("Cash Advance");
    //   }
    //   if (account.available < account.limit) {
    //     options.push("Make Cash Payment");
    //   }
    //   if (options.length < 1) {
    //     this.console
    //       .appendLines(["", "This account has no viable operations."])
    //       .then(resolve);
    //     return;
    //   }
    //   let prompt =
    //     "Select an operation: " +
    //     options.map((o, i) => `[${i + 1}] ${o}`).join(" ") +
    //     " [ESC] Cancel:";
    //   this.console.appendLines(["", prompt, ""]).then(() => {
    //     let handler = Tools.addEventHandler(
    //       document,
    //       "keyup",
    //       e => {
    //         if (e.keyCode == 27) {
    //           Tools.removeEventHandler(handler);
    //           this.console.appendLines(["", "Cancel."]).then(reject);
    //         } else {
    //           let num = Number(e.key);
    //           if (num > 0 && num <= options.length) {
    //             switch (options[num - 1]) {
    //               case "Cash Advance":
    //                 Tools.removeEventHandler(handler);
    //                 this.console
    //                   .appendLines([
    //                     "",
    //                     `You selected: Cash Advance from ${account.name}`
    //                   ])
    //                   .then(() =>
    //                     this.runWithdraw(
    //                       "Cash Advance",
    //                       account,
    //                       account.available
    //                     )
    //                   );
    //                 break;
    //               case "Make Cash Payment":
    //                 Tools.removeEventHandler(handler);
    //                 this.console
    //                   .appendLines([
    //                     "",
    //                     `You selected: Make Cash Payment to ${account.name}`
    //                   ])
    //                   .then(() =>
    //                     this.runDeposit(account)
    //                   );
    //                 break;
    //               default:
    //                 Tools.play(Sounds.error);
    //             }
    //           } else {
    //             Tools.play(Sounds.error);
    //           }
    //         }
    //       },
    //       this
    //     );
    //   });
    // });
  }
  async runManageLoan(account) {
    // return new Promise((resolve, reject) => {
    //   let options = [];
    //   if (account.hasRedraw && account.balance > account.limit) {
    //     options.push("Redraw to Cash");
    //     options.push("Redraw Transfer");
    //   } else if (account.balance < 0) {
    //     options.push("Make Cash Payment");
    //   }
    //   if (options.length < 1) {
    //     this.console
    //       .appendLines(["", "This account has no viable operations."])
    //       .then(resolve);
    //     return;
    //   }
    //   let prompt =
    //     "Select an operation: " +
    //     options.map((o, i) => `[${i + 1}] ${o}`).join(" ") +
    //     " [ESC] Cancel:";
    //   this.console.appendLines(["", prompt, ""]).then(() => {
    //     let handler = Tools.addEventHandler(
    //       document,
    //       "keyup",
    //       e => {
    //         if (e.keyCode == 27) {
    //           Tools.removeEventHandler(handler);
    //           this.console.appendLines(["", "Cancel."]).then(() => reject);
    //         } else {
    //           let num = Number(e.key);
    //           if (num > 0 && num <= options.length) {
    //             switch (options[num - 1]) {
    //               case "Redraw to Cash":
    //                 Tools.removeEventHandler(handler);
    //                 this.console
    //                   .appendLines([
    //                     "",
    //                     `You selected: Redraw to Cash from ${account.name}`
    //                   ])
    //                   .then(() =>
    //                     this.runWithdraw(
    //                       "Redraw Cash",
    //                       account,
    //                       account.limit - account.balance
    //                     ).then(resolve, reject)
    //                   );
    //                 break;
    //               case "Redraw Transfer":
    //                 Tools.removeEventHandler(handler);
    //                 this.console
    //                   .appendLines([
    //                     "",
    //                     `You selected: Redraw Transfer from ${account.name}`
    //                   ])
    //                   .then(() =>
    //                     this.runTransfer(account)
    //                   );
    //                 break;
    //               case "Make Cash Payment":
    //                 Tools.removeEventHandler(handler);
    //                 this.console
    //                   .appendLines([
    //                     "",
    //                     `You selected: Make Cash Payment to ${account.name}`
    //                   ])
    //                   .then(() =>
    //                     this.runDeposit(account)
    //                   );
    //                 break;
    //               default:
    //                 Tools.play(Sounds.error);
    //             }
    //           } else {
    //             Tools.play(Sounds.error);
    //           }
    //         }
    //       },
    //       this
    //     );
    //   });
    // });
  }
  async runWithdraw(action, account, max) {
    max = max > 500 ? 500 : max;
    while (true) {
      let amount = await this.readAmount(`Please enter an amount (max: ${max.toFixed(2)}): `);
      let val = Number(amount);
      if (val > 0 && val <= max) {
        let key = await this.readKey(`${action}: ${val.toFixed(2)}? (Y/N): `, "YNyn", false);
        if (key == 27) {
          await this.console.appendLines("", "Canceled.", "");
          return;
        }
        else if (key == "Y" || key == "y") {
          try {
            let response = await this.callAPI("authorizewithdrawal", {
              account_id: account.account_id,
              amount: val
            });
            if (response.response.result == "success") {
              let lock = response.response.lock_id;
              try {
                await this.dispenser.dispense(val);
                try {
                  let response = await this.callAPI("applywithdrawal", { lock_id: lock });
                  account.total = response.response.balance.total;
                  account.available = response.response.balance.available;
                  account.limit = response.response.balance.limit;
                  await this.console.appendLines(["", `Cash dispensed. Receipt No: ${response.response.receipt_no}`, "", ""]);
                  return;
                }
                catch (response) {
                  await this.console.appendLines(["", `Error:${response.response.error}`, ""]);
                  return;
                }
              }
              catch (amount) {
                await this.console.appendLines(["", `Cash dispensing failed, only ${amount.toFixed(2)} could be dispensed`, "Please attend a branch to arrange release of locked funds", ""]);
                return;
              }
            } else {
              await this.console.appendLines(["", "Could not lock funds for withdrawal: " + response.response.error, ""]);
              return;
            }
          }
          catch (response) {
            await this.console.appendLines(["", "Could not lock funds for withdrawal: " + response.response.error, ""]);
            return;
          }
        }
      } else {
        await this.console.appendLines(["", "Invalid amount entered."]);
        Tools.play(Sounds.error);
      }
    }
  }
  async runTransfer(account) {
    return new Promise((resolve, reject) => { });
  }
  async runDeposit(account) {
    return new Promise((resolve, reject) => { });
  }
  async waitForCard() {
    do {
      await this.console.display("DSC Bank of Daytona - Your Education, Our Money", "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~", `Automatch Teller Machine#: ${this.id}`, "", "Please insert your membership card to begin...", "");
      let cardnumber = await this.cardreader.waitForCard();
      this.session = {
        cardnumber: cardnumber,
        session_id: new Date().getTime() + "_SESSION"
      };
      await this.console.appendLines(["", `Card number: ${cardnumber}`, ""]);
    }
    while (!await this.waitForPIN());
    await this.runAccountsList();
  }
  async waitForPIN() {
    while (true) {
      await this.console.appendLines("", "Please enter your personal identification number (PIN), [ESC] to cancel, [ENTER] to confirm.", "");
      try {
        let pin = await this.pinreader.waitForPIN();
        try {
          let response = await this.callAPI("authenticatebycard", { card_number: this.session.cardnumber, pin: pin });
          if (response.response.result === "success") {
            this.session.valid_to = response.response.valid_to;
            this.session.name = response.response.name;
            this.session.firstName = response.response.firstName;
            return true;
          } else {
            if (response.response.failure_count >= 3) {
              Tools.play(Sounds.error);
              await this.console.appendLines("Verification failed. PIN incorrect.", "", "", "Attempts Exceeded. Card captured.", "Please attend a DSC Bank Daytona branch to retrieve your card", "");
              this.cardreader.captureCard();
              await new Promise(resolve => {
                setTimeout(resolve, 2000);
              });
              return false;
            } else {
              Tools.play(Sounds.error);
              await this.console.appendLines("", "Verification failed. PIN incorrect.", "");
            }
          }
        } catch (response) {
          throw response.response && response.response.error ? response.response.error : "Unknown error occurred!";
        }
      }
      catch {
        await this.runEjectCard("Canceled.");
        return false;
      }
    }
  }
}
