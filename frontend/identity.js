// 匿名设备识别：生成并持久化唯一设备 ID，无需注册/登录。
// 每个浏览器的 localStorage 里存一个 prio_device_id，后续所有请求都带上，后端用它区分不同用户。

const KEY = 'prio_device_id';

function getDeviceId() {
  let id = null;
  try {
    id = localStorage.getItem(KEY);
  } catch (e) {
    // localStorage 不可用（无痕模式等），每次生成新 ID（会话级别）
  }
  if (!id) {
    id = crypto.randomUUID();
    try {
      localStorage.setItem(KEY, id);
    } catch (e) {
      // 静默忽略
    }
  }
  return id;
}

export { getDeviceId };
