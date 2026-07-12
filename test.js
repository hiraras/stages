/**
 * 解析 URL，返回结构化对象
 * @param {string} urlString - 待解析的 URL
 * @returns {{
 *   href: string,
 *   protocol: string,
 *   host: string,
 *   hostname: string,
 *   port: string,
 *   pathname: string,
 *   search: string,
 *   hash: string,
 *   origin: string,
 *   params: Record<string, string>
 * }}
 */
function parseUrl(urlString) {
    const url = new URL(urlString);

    const params = {};
    url.searchParams.forEach((value, key) => {
        params[key] = value;
    });

    return {
        href: url.href,
        protocol: url.protocol,
        host: url.host,
        hostname: url.hostname,
        port: url.port,
        pathname: url.pathname,
        search: url.search,
        hash: url.hash,
        origin: url.origin,
        params,
    };
}
/**
 * 验证邮箱格式是否合法
 * @param {string} email - 待验证的邮箱地址
 * @returns {boolean}
 */
function isValidEmail(email) {
    if (typeof email !== "string") return false;

    const trimmed = email.trim();
    if (!trimmed) return false;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(trimmed);
}

/**
 * 验证手机号格式是否合法（中国大陆 11 位手机号）
 * @param {string} phone - 待验证的电话号码
 * @returns {boolean}
 */
function isValidPhone(phone) {
    if (typeof phone !== "string") return false;

    const trimmed = phone.trim();
    if (!trimmed) return false;

    const normalized = trimmed.replace(/[\s-]/g, "");
    const phoneRegex = /^1[3-9]\d{9}$/;
    return phoneRegex.test(normalized);
}

/**
 * 验证 QQ 号格式是否合法（5-11 位数字，首位不为 0）
 * @param {string} qq - 待验证的 QQ 号
 * @returns {boolean}
 */
function isValidQQ(qq) {
    if (typeof qq !== "string") return false;

    const trimmed = qq.trim();
    if (!trimmed) return false;

    const qqRegex = /^[1-9]\d{4,10}$/;
    return qqRegex.test(trimmed);
}

/**
 * 判断当前是否运行在 Web 浏览器环境
 * @returns {boolean}
 */
function isWeb() {
    return typeof window !== "undefined" && typeof document !== "undefined";
}

module.exports = { parseUrl, isValidEmail, isValidPhone, isValidQQ, isWeb };
