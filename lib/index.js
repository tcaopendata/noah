'use strict';

const CronJob = require('cron').CronJob;
const fetch = require('isomorphic-fetch');
const notifier = require('node-notifier');
const constants = require('../constants');

const httpRequest = (path, method, body = undefined) => {
  return fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json'
    },
    body
  })
  .then((res) => {
    if (res.status >= 400) {
      throw new Error("Bad response from server")
    }
    return res.json();
  });
};

const setTrayIconForWaterLevel = (waterLevel, appIcon = null) => {
  const embankmentHeight = waterLevel.height;
  const currentWaterLevel = waterLevel.waterLevel;
  const levelOfWaterLevel= (currentWaterLevel / embankmentHeight) * 100;

  let trayIcon;
  if (levelOfWaterLevel >= 0 && levelOfWaterLevel < 20) {
    trayIcon = constants.trayIcon1;
  } else if (levelOfWaterLevel >= 20 && levelOfWaterLevel < 40) {
    trayIcon = constants.trayIcon2;
  } else if (levelOfWaterLevel >= 40 && levelOfWaterLevel < 60) {
    trayIcon = constants.trayIcon3;
    this.generateNotify(); // TODO: 水位 or 降水量の遷移によって通知を出し分ける
  } else if (levelOfWaterLevel >= 60 && levelOfWaterLevel < 80) {
    trayIcon = constants.trayIcon4;
    this.generateNotify(); // TODO: 水位 or 降水量の遷移によって通知を出し分ける
  } else if (levelOfWaterLevel >= 80 && levelOfWaterLevel < 100) {
    trayIcon = constants.trayIcon5;
    this.generateNotify(); // TODO: 水位or 降水量の遷移によって通知を出し分ける
  } else {
    throw new Error(`Fault levelOfWaterLevel. levelOfWaterLevel: ${levelOfWaterLevel}`);
  }

  if (appIcon) {
    appIcon.setImage(trayIcon);
  }
};

const generateNotify = () => {
  return notifier.notify({
    title: '警告',
    message: '水位が急上昇しています!',
    icon: constants.pushIcon,
    wait: true,
  });
};

const requestWaterLevel = (libObj, param) => {
  httpRequest(libObj.getWaterLevelURL(), 'GET')
    .then((res) => {
      try {
        setTrayIconForWaterLevel(res, param);
      } catch (err) {
        throw err;
      }
    })
    .catch((err) => {
      console.error(err.stack);
    });
};

const getWarning = (precipitation, trendPr, trendWl) => {
  return precipitation > 100 && (trendPr === 4 || trendWl === 4);
};

// export class
module.exports = class Lib {
  constructor({ country, prefecture, river }, host, env) {
    this.env = env;
    this.host = host;
    this.country = country;
    this.prefecture = prefecture;
    this.river = river;
    this.list = [
      { country: 'japan', prefecture: 'ishikawa', river: 'asano' },
      { country: 'japan', prefecture: 'tokyo', river: 'arakawa' },
      { country: 'taiwan', prefecture: 'taipei', river: 'danshui' },
    ];
    this.qrsize = 140;
    this.geolocation = {
      latitude: 0,
      longitude: 0,
    };
  }
  setCurrentLocation ({ country = this.country, prefecture = this.prefecture, river = this.river }) {
    this.country = country;
    this.prefecture = prefecture;
    this.river = river;
  }
  setGeolocation ({ latitude = this.latitude, longitude = this.longitude }) {
    this.geolocation = {
      latitude,
      longitude,
    };
  }
  getCurrentLocation () {
    return { country: this.country, prefecture: this.prefecture, river: this.river };
  }
  getWaterLevelURL () {
    return `https://${this.host}/${this.env}/water-level/${this.country}/${this.prefecture}/${this.river}`;
  }
  getWaterLevelTrendURL () {
    return `https://${this.host}/${this.env}/water-level-trend/${this.country}/${this.prefecture}/${this.river}`;
  }
  getRainFallURL () {
    return `https://${this.host}/${this.env}/rain-fall/${this.country}/${this.prefecture}/${this.river}`;
  }
  getRainFallTrendURL () {
    return `https://${this.host}/${this.env}/rain-fall-trend/${this.country}/${this.prefecture}/${this.river}`;
  }
  getMapURL () {
    const { latitude, longitude } = this.geolocation;

    // err handling
    if (latitude === 999 || longitude === 999) return '';

    const destination = '入江タリーズ'; // TODO: 引数で受け取れるようにする
    return `https://www.google.co.jp/maps/dir/${latitude},${longitude}/${encodeURIComponent(destination)}/`;
  }
  getQrURL () {
    const chl = this.getMapURL();
    return `http://chart.apis.google.com/chart?chs=${this.qrsize}x${this.qrsize}&cht=qr&chl=${chl}`;
  }
  getData () {
    let precipitation = Math.floor(Math.random() * 999); // TODO fix
    httpRequest(this.getRainFallURL(), 'GET')
      .then((res) => {
          precipitation = res.rainFall;
      })
      .catch((err) => console.error(err));
    let trendPr = Math.floor(Math.random() * 5); // TODO fix
    httpRequest(this.getRainFallTrendURL(), 'GET')
      .then((res) => {
        trendPr = res;
      })
      .catch((err) => console.error(err));
    let trendWl = Math.floor(Math.random() * 5); // TODO fix
    httpRequest(this.getWaterLevelTrendURL(), 'GET')
      .then((res) => {
        trendWl = res;
      })
      .catch((err) => console.error(err));
    const warning = getWarning(precipitation, trendPr, trendWl);
    const qrSrc = this.getQrURL();
    const mapSrc = this.getMapURL();
    return {
      precipitation,
      trendPr,
      trendWl,
      warning,
      qrSrc,
      mapSrc,
    };
  }
  getLocation () {
    return {
      current: this.getCurrentLocation(),
      list: this.list,
    };
  }
  polling (param, cronTime) {
    const job = new CronJob({
      cronTime,
      onTick: () => requestWaterLevel(this, param),
      start: true,
    });
    job.start();
  }
};
