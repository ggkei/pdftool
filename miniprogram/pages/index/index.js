const config = require('../../config');
const api = require('../../utils/api');
const app = getApp();

Page({
  data: {
    openid: '',
    adCount: 0,
    code: '',
    membershipCode: '',
    rewardGranted: false,
    adLoading: false,
    requesting: false,
    showModal: false,
    websiteUrl: config.WEBSITE_URL,
  },

  onLoad() {
    this.initAd();
    this.checkOpenid();
  },

  onShow() {
    this.checkOpenid();
  },

  checkOpenid() {
    if (app.globalData.openid) {
      this.setData({ openid: app.globalData.openid });
    } else {
      setTimeout(() => this.checkOpenid(), 500);
    }
  },

  initAd() {
    try {
      this.rewardedVideoAd = wx.createRewardedVideoAd({
        adUnitId: config.AD_UNIT_ID,
      });

      this.rewardedVideoAd.onLoad(() => {
        console.log('[ad] 广告加载成功');
        this.setData({ adLoading: false });
      });

      this.rewardedVideoAd.onError((err) => {
        console.error('[ad] 广告加载失败', err);
        this.setData({ adLoading: false });
      });

      this.rewardedVideoAd.onClose((res) => {
        console.log('[ad] 广告关闭', res);
        if (res.isEnded) {
          this.requestReward();
        } else {
          wx.showToast({ title: '需要看完广告才能获取验证码', icon: 'none' });
        }
      });
    } catch (e) {
      console.error('[ad] 创建广告实例失败', e);
    }
  },

  watchAd() {
    if (!this.data.openid) {
      wx.showToast({ title: '正在登录，请稍候...', icon: 'none' });
      app.login();
      return;
    }

    if (!this.rewardedVideoAd) {
      wx.showToast({ title: '广告组件未就绪，请用测试模式', icon: 'none', duration: 2500 });
      return;
    }

    this.setData({ adLoading: true });
    this.rewardedVideoAd.show().catch(() => {
      this.rewardedVideoAd.load().then(() => {
        this.rewardedVideoAd.show();
      }).catch(() => {
        this.setData({ adLoading: false });
        wx.showToast({ title: '广告加载失败，请用测试模式', icon: 'none', duration: 2500 });
      });
    });
  },

  testReward() {
    if (!this.data.openid) {
      wx.showToast({ title: '正在登录，请稍候...', icon: 'none' });
      app.login();
      return;
    }
    wx.showModal({
      title: '测试模式',
      content: '跳过广告直接获取验证码（仅用于本地测试）',
      success: (res) => {
        if (res.confirm) {
          this.requestReward();
        }
      },
    });
  },

  requestReward() {
    this.setData({ requesting: true });
    wx.showLoading({ title: '获取验证码...' });
    api.adReward(this.data.openid, config.AD_UNIT_ID)
      .then((data) => {
        wx.hideLoading();
        if (data.ok) {
          this.setData({
            code: data.code,
            adCount: data.adCount,
            rewardGranted: data.rewardGranted,
            membershipCode: data.membershipCode || '',
            showModal: true,
          });
        } else {
          wx.showToast({ title: data.reason || '获取失败', icon: 'none' });
        }
      })
      .catch((err) => {
        wx.hideLoading();
        wx.showToast({ title: err.reason || '网络错误，请重试', icon: 'none' });
      })
      .finally(() => {
        this.setData({ requesting: false });
      });
  },

  copyCode() {
    wx.setClipboardData({
      data: this.data.code,
      success: () => wx.showToast({ title: '验证码已复制', icon: 'success' }),
    });
  },

  copyMembershipCode() {
    wx.setClipboardData({
      data: this.data.membershipCode,
      success: () => wx.showToast({ title: '会员码已复制', icon: 'success' }),
    });
  },

  copyWebsite() {
    wx.setClipboardData({
      data: config.WEBSITE_URL,
      success: () => wx.showToast({ title: '网址已复制', icon: 'success' }),
    });
  },

  closeModal() {
    this.setData({ showModal: false });
  },

  stopPropagation() {},
});
