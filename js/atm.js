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
    this.console = new ATMConsole(consoleElement);
    this.dispenser = new ATMCashDispenser(dispenserElement);
    this.dispenser.dispense("50");
    this.cardreader = new ATMCardReader(cardreaderElement);
    this.reader = new ATMCashReader();
    this.pinreader = new ATMPinReader(pinreaderElement);
    this.id = 715;
    this.host = new FinancialHost();
    this.session = null;
    Tools.play(Sounds.startup).then(() =>
      this.console
        .appendLines([])
        .then(() => this.host.init().then(() => this.waitForCard()))
    );
  }
  callAPI(call, payload) {
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
    return this.host.api(request);
  }

  // accounts list gets the list of accounts from the host
  // and displays them as a selectable menu
  // it uses getAccountsList, accountsListHeader, listAccounts, accountsListFooter
  // when done, it chains control to selectAccount
  runAccountsList() {
    this.getAccountList().then(
      () => this.accountListHeader(),
      response => {
        // failed to get account list from host
      }
    );
  }
  getAccountList() {
    return this.callAPI("listaccountsbytype", { type: "ALL" }).then(
      response => {
        this.session.accounts = response.response.accounts;
      },
      response => {
        this.console.appendLines(["", "Error: " + response.response.error, ""]);
      }
    );
  }
  accountListHeader() {
    if (this.session.accounts.length > 0) {
      return this.console
        .appendLines([
          "",
          "You have " + this.session.accounts.length + " accounts:",
          "",
          ""
        ])
        .then(() => this.listAccounts());
    } else {
      return this.console
        .appendLines([
          "",
          "You do not have any accessible accounts.",
          "",
          "Ejecting card. Please take your card."
        ])
        .then(() => this.cardreader.ejectCard())
        .then(() => this.waitForCard());
    }
  }
  listAccounts() {
    return this.console
      .appendLines(
        this.session.accounts.map(
          (a, i) =>
            i +
            1 +
            ": " +
            a.name +
            " (" +
            a.type +
            "), Balance: " +
            a.balance.toFixed(2) +
            ", Available: " +
            a.available.toFixed(2)
        )
      )
      .then(() => this.accountListFooter());
  }
  accountListFooter() {
    return this.console
      .appendLines([
        "",
        "",
        "Please select an account to manage (1 - " +
          this.session.accounts.length +
          ", [ESC] to Cancel): "
      ])
      .then(() => this.selectAccount().then(() => this.waitForCard()));
  }
  selectAccount() {
    return new Promise((resolve, reject) => {
      let handler = Tools.addEventHandler(
        document,
        "keyup",
        e => {
          if (e.keyCode == 27) {
            this.console
              .appendLines([
                "",
                "Cancel.",
                "",
                "Ejecting card. Please take your card.",
                ""
              ])
              .then(() => {
                Tools.removeEventHandler(handler);
                this.cardreader.ejectCard();
                this.cardreader.waitForTakeCard().then(resolve);
              });
          } else {
            let num = Number(e.key);
            if (num > 0 && num <= this.session.accounts.length) {
              Tools.removeEventHandler(handler);
              this.console
                .appendLines([
                  "",
                  "You selected: " + this.session.accounts[num - 1].name,
                  ""
                ])
                .then(() =>
                  this.runManageAccount(this.session.accounts[num - 1]).then(
                    resolve,
                    reject
                  )
                );
            } else {
              Tools.play(Sounds.error);
            }
          }
        },
        this
      );
    });
  }

  // runManageAccount uses the selected account as a basis for executing deposits, withdrawals, and transfers
  runManageAccount(account) {
    return new Promise((resolve, reject) => {
      switch (account.type) {
        case "SAVINGS":
          this.runManageSavings(account).then(() =>
            this.accountListHeader().then(resolve, reject)
          );
          break;
        case "CREDIT":
          this.runManageCredit(account).then(() =>
            this.accountListHeader().then(resolve, reject)
          );
          break;
        case "LOAN":
          this.runManageLoan(account).then(() =>
            this.accountListHeader().then(resolve, reject)
          );
          break;
      }
    });
  }
  runManageSavings(account) {
    return new Promise((resolve, reject) => {
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
      let prompt =
        "Select an operation: " +
        options.map((o, i) => "[" + (i + 1) + "] " + o).join(" ") +
        " [ESC] Cancel:";
      this.console.appendLines(["", prompt, ""]).then(() => {
        let handler = Tools.addEventHandler(
          document,
          "keyup",
          e => {
            if (e.keyCode == 27) {
              Tools.removeEventHandler(handler);
              this.console.appendLines(["", "Cancel."]).then(resolve);
            } else {
              let num = Number(e.key);
              if (num > 0 && num <= options.length) {
                switch (options[num - 1]) {
                  case "Cash Withdrawal":
                    Tools.removeEventHandler(handler);
                    this.console
                      .appendLines([
                        "",
                        "You selected: Cash Withdrawal from " + account.name
                      ])
                      .then(() =>
                        this.runWithdraw(
                          "Cash Withdrawal",
                          account,
                          account.available
                        ).then(resolve)
                      );
                    break;
                  case "Funds Transfer":
                    Tools.removeEventHandler(handler);
                    this.console
                      .appendLines([
                        "",
                        "You selected: Funds Transfer from " + account.name
                      ])
                      .then(() => this.runTransfer(account).then(resolve));
                    break;
                  case "Cash Deposit":
                    Tools.removeEventHandler(handler);
                    this.console
                      .appendLines([
                        "",
                        "You selected: Cash Deposit to " + account.name
                      ])
                      .then(() => this.runDeposit(account).then(resolve));
                    break;
                  default:
                    Tools.play(Sounds.error);
                }
              } else {
                Tools.play(Sounds.error);
              }
            }
          },
          this
        );
      });
    });
  }
  runManageCredit(account) {
    return new Promise((resolve, reject) => {
      let options = [];
      if (account.available > 0) {
        options.push("Cash Advance");
      }
      if (account.available < account.limit) {
        options.push("Make Cash Payment");
      }
      if (options.length < 1) {
        this.console
          .appendLines(["", "This account has no viable operations."])
          .then(resolve);
        return;
      }
      let prompt =
        "Select an operation: " +
        options.map((o, i) => "[" + (i + 1) + "] " + o).join(" ") +
        " [ESC] Cancel:";
      this.console.appendLines(["", prompt, ""]).then(() => {
        let handler = Tools.addEventHandler(
          document,
          "keyup",
          e => {
            if (e.keyCode == 27) {
              Tools.removeEventHandler(handler);
              this.console.appendLines(["", "Cancel."]).then(reject);
            } else {
              let num = Number(e.key);
              if (num > 0 && num <= options.length) {
                switch (options[num - 1]) {
                  case "Cash Advance":
                    Tools.removeEventHandler(handler);
                    this.console
                      .appendLines([
                        "",
                        "You selected: Cash Advance from " + account.name
                      ])
                      .then(() =>
                        this.runWithdraw(
                          "Cash Advance",
                          account,
                          account.available
                        ).then(resolve, reject)
                      );
                    break;
                  case "Make Cash Payment":
                    Tools.removeEventHandler(handler);
                    this.console
                      .appendLines([
                        "",
                        "You selected: Make Cash Payment to" + account.name
                      ])
                      .then(() =>
                        this.runDeposit(account).then(resolve, reject)
                      );
                    break;
                  default:
                    Tools.play(Sounds.error);
                }
              } else {
                Tools.play(Sounds.error);
              }
            }
          },
          this
        );
      });
    });
  }
  runManageLoan(account) {
    return new Promise((resolve, reject) => {
      let options = [];
      if (account.hasRedraw && account.balance > account.limit) {
        options.push("Redraw to Cash");
        options.push("Redraw Transfer");
      } else if (account.balance < 0) {
        options.push("Make Cash Payment");
      }
      if (options.length < 1) {
        this.console
          .appendLines(["", "This account has no viable operations."])
          .then(resolve);
        return;
      }
      let prompt =
        "Select an operation: " +
        options.map((o, i) => "[" + (i + 1) + "] " + o).join(" ") +
        " [ESC] Cancel:";
      this.console.appendLines(["", prompt, ""]).then(() => {
        let handler = Tools.addEventHandler(
          document,
          "keyup",
          e => {
            if (e.keyCode == 27) {
              Tools.removeEventHandler(handler);
              this.console.appendLines(["", "Cancel."]).then(() => reject);
            } else {
              let num = Number(e.key);
              if (num > 0 && num <= options.length) {
                switch (options[num - 1]) {
                  case "Redraw to Cash":
                    Tools.removeEventHandler(handler);
                    this.console
                      .appendLines([
                        "",
                        "You selected: Redraw to Cash from " + account.name
                      ])
                      .then(() =>
                        this.runWithdraw(
                          "Redraw Cash",
                          account,
                          account.limit - account.balance
                        ).then(resolve, reject)
                      );
                    break;
                  case "Redraw Transfer":
                    Tools.removeEventHandler(handler);
                    this.console
                      .appendLines([
                        "",
                        "You selected: Redraw Transfer from " + account.name
                      ])
                      .then(() =>
                        this.runTransfer(account).then(resolve, reject)
                      );
                    break;
                  case "Make Cash Payment":
                    Tools.removeEventHandler(handler);
                    this.console
                      .appendLines([
                        "",
                        "You selected: Make Cash Payment to " + account.name
                      ])
                      .then(() =>
                        this.runDeposit(account).then(resolve, reject)
                      );
                    break;
                  default:
                    Tools.play(Sounds.error);
                }
              } else {
                Tools.play(Sounds.error);
              }
            }
          },
          this
        );
      });
    });
  }
  readAmount() {
    return new Promise(resolve => {
      let input = "";
      let handle = Tools.addEventHandler(
        document,
        "keyup",
        e => {
          let val = Number(e.key);
          if (val >= 0 && val <= 9) {
            input += val;
            this.console.writeChar(val, true);
          } else if (e.key == "." && input.indexOf(".") < 0) {
            input += ".";
            this.console.writeChar(".", true);
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
  readKey(set) {
    return new Promise(resolve => {
      let input = "";
      let handle = Tools.addEventHandler(
        document,
        "keyup",
        e => {
          if (set.indexOf(e.key) >= 0) {
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
  runWithdraw(action, account, max) {
    return new Promise((resolve, reject) => {
      max = max > 500 ? 500 : max;
      this.console
        .appendLines([
          "",
          "Please enter an amount (max: " + max.toFixed(2) + "): "
        ])
        .then(() => {
          this.readAmount().then(val => {
            val = Number(val);
            if (val > 0 && val <= max) {
              this.console
                .appendLines(["", action + ": " + val.toFixed(2) + "? (Y/N): "])
                .then(() =>
                  this.readKey("ynYN").then(key => {
                    if (key == "Y" || key == "y") {
                      this.callAPI("authorizewithdrawal", {
                        account_id: account.account_id,
                        amount: val
                      }).then(response => {
                        if (response.response.result == "success") {
                          let lock = response.response.lock_id;
                          this.dispenser.dispense(val).then(() => {
                            this.callAPI("applywithdrawal", {
                              lock_id: lock
                            }).then(response => {
                              account.total = response.response.balance.total;
                              account.available = response.response.balance.available;
                              account.limit = response.response.balance.limit;
                              this.console.appendLines(["", "Cash dispensed. Receipt No: " + response.response.receipt_no, ""]).then(resolve);
                            }, response => {
                              this.console.appendLines(["","Error:" + response.response.error, ""]).then(resolve);
                            });
                          }, amount => {
                             this.console.appendLines(["", "Cash dispensing failed, only " + amount.toFixed(2) + " could be dispensed","Please attend a branch to arrange release of locked funds", ""]).then(resolve);
                          });
                        } else {
                          this.console.appendLines(["","Could not lock funds for withdrawal: " + response.response.error, ""]).then(resolve);
                        }
                      }, response => {
                        this.console.appendLines(["","Could not lock funds for withdrawal: " + response.response.error, ""]).then(resolve);
                      });
                    } else {
                      this.console.appendLines(["", "Canceled.", ""]).then(resolve);
                    }
                  })
                );
            } else {
              this.console
                .appendLines(["", "Invalid amount entered."])
                .then(() =>
                  this.runWithdraw(action, account, max).then(resolve, reject)
                );
            }
          });
        });
    });
  }
  runTransfer(account) {
    return new Promise((resolve, reject) => {});
  }
  runDeposit(account) {
    return new Promise((resolve, reject) => {});
  }
  waitForCard() {
    return this.console
      .display([
        "DSC Bank of Daytona - Your Education, Our Money",
        "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
        "Automatch Teller Machine#: " + this.id,
        "",
        "Please insert your membership card to begin...",
        ""
      ])
      .then(() =>
        this.cardreader
          .waitForCard()
          .then(cardnumber =>
            this.console
              .appendLines(["", "Card number: " + cardnumber, ""])
              .then(() => this.waitForPIN(cardnumber))
          )
      );
  }
  waitForPIN(cardnumber) {
    return new Promise((resolve, reject) => {
      this.console
        .appendLines([
          "",
          "Please enter your personal identification number (PIN), [ESC] to cancel, [ENTER] to confirm.",
          ""
        ])
        .then(() =>
          this.pinreader.waitForPIN().then(
            pin => {
              this.session = {
                session_id: new Date().getTime() + "_SESSION"
              };
              this.callAPI("authenticatebycard", {
                card_number: cardnumber,
                pin: pin
              }).then(
                response => {
                  if (response.response.result === "success") {
                    this.session.valid_to = response.response.valid_to;
                    this.session.name = response.response.name;
                    this.session.firstName = response.response.firstName;
                    resolve();
                  } else {
                    if (response.response.failure_count >= 3) {
                      Tools.play(Sounds.error);
                      this.console
                        .appendLines([
                          "Verification failed. PIN incorrect.",
                          "",
                          "",
                          "Attempts Exceeded. Card captured.",
                          "Please attend a DSC Bank Daytona branch to retrieve your card",
                          ""
                        ])
                        .then(() => {
                          this.cardreader.captureCard();
                          setTimeout(reject, 2000);
                        });
                    } else {
                      Tools.play(Sounds.error);
                      this.console
                        .appendLines([
                          "",
                          "Verification failed. PIN incorrect.",
                          ""
                        ])
                        .then(() => this.waitForPIN(cardnumber));
                    }
                  }
                },
                response => {
                  this.console
                    .appendLines([
                      "",
                      "Error: " + response.response && response.response.error
                        ? response.response.error
                        : "Unknown error occurred!",
                      "Ejecting card. Please take your card.",
                      ""
                    ])
                    .then(() => {
                      this.cardreader.ejectCard();
                      reject("FAILED");
                    });
                }
              );
            },
            () => {
              this.console
                .appendLines([
                  "",
                  "Canceled.",
                  "Ejecting card. Please take your card."
                ])
                .then(() => {
                  this.cardreader.ejectCard();
                  this.cardreader.waitForTakeCard().then(reject);
                });
            }
          )
        );
    }).then(() => this.runAccountsList(), () => this.waitForCard());
  }
}
