export class Tools {
  static addEventHandler(element, type, func, context) {
    if (context) {
      func = func.bind(context);
    }
    func.type = type;
    func.element = element;
    element.addEventListener(type, func);
    return func;
  }
  static removeEventHandler(handler) {
    handler.element.removeEventListener(handler.type, handler);
  }
  static play(src, volume) {
    return new Promise(resolve => {
      let sound = document.createElement("AUDIO");
      sound.src = src;
      if (volume) {
        sound.volume = volume;
      }
      sound.play().then(resolve, () => {}).catch(() => { });
    });
  }
  static fetchJSONFile(path) {
    return new Promise((resolve, reject) => {
      let httpRequest = new XMLHttpRequest();
      httpRequest.onreadystatechange = () => {
        if (httpRequest.readyState === 4) {
          if (httpRequest.status === 200) {
            var data = JSON.parse(httpRequest.responseText);
            resolve(data);
          }
        }
      };
      httpRequest.open("GET", path);
      httpRequest.send();
    });
  }
}

export const Sounds = {
  error:
    "media/sounds/error.wav",
  cardreader:
    "media/sounds/atm-card-sound.mp3",
  pinbutton:
    "media/sounds/atm-button-sound.mp3",
  welcome:
    "media/sounds/welcome.mp3",
  startup:
    "media/sounds/poweron.mp3",
  console:
    "media/sounds/tick.wav"
};
