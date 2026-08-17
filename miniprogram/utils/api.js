const config = require('../config');

function request(options) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${config.API_BASE}${options.url}`,
      method: options.method || 'GET',
      header: {
        'Content-Type': 'application/json',
        ...options.header,
      },
      data: options.data || {},
      success: (resp) => {
        if (resp.statusCode >= 200 && resp.statusCode < 300) {
          resolve(resp.data);
        } else {
          reject(resp.data || { reason: '请求失败' });
        }
      },
      fail: (err) => {
        reject({ reason: '网络错误，请检查网络连接' });
      },
    });
  });
}

module.exports = {
  request,

  login(code) {
    return request({
      url: '/api/wechat/login',
      method: 'POST',
      data: { code },
    });
  },

  adReward(openid, adUnitId) {
    return request({
      url: '/api/wechat/ad-reward',
      method: 'POST',
      data: {
        identifier: openid,
        identifierType: 'openid',
        adUnitId,
      },
    });
  },
};
