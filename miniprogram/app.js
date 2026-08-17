const config = require('./config');

App({
  globalData: {
    openid: '',
    apiBase: config.API_BASE,
  },

  onLaunch() {
    this.login();
  },

  login() {
    wx.login({
      success: (res) => {
        console.log('[login] wx.login 成功, code:', res.code);
        if (!res.code) {
          console.error('[login] code 为空，使用兜底 openid');
          this.fallbackOpenid();
          return;
        }
        wx.request({
          url: `${this.globalData.apiBase}/api/wechat/login`,
          method: 'POST',
          header: { 'Content-Type': 'application/json' },
          data: { code: res.code },
          success: (resp) => {
            console.log('[login] 接口返回:', resp.statusCode, resp.data);
            if (resp.data.ok) {
              this.setOpenid(resp.data.openid);
            } else {
              console.error('[login] 接口报错:', resp.data);
              this.fallbackOpenid();
            }
          },
          fail: (err) => {
            console.error('[login] 请求失败:', err);
            this.fallbackOpenid();
          },
        });
      },
      fail: (err) => {
        console.error('[login] wx.login 失败:', err);
        this.fallbackOpenid();
      },
    });
  },

  fallbackOpenid() {
    const testOpenid = 'local_test_' + Date.now();
    console.log('[login] 使用兜底 openid:', testOpenid);
    this.setOpenid(testOpenid);
  },

  setOpenid(openid) {
    this.globalData.openid = openid;
    const pages = getCurrentPages();
    if (pages.length > 0) {
      pages[pages.length - 1].setData({ openid });
    }
  },
});
