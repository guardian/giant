export function isLoggedIn(auth) {
    const d = new Date();
    const seconds = Math.round(d.getTime() / 1000);
    return auth.token !== undefined && // have token
        auth.token.exp !== undefined && auth.token.exp > seconds && // token has been renewed recently
        auth.token.loginExpiry !== undefined && auth.token.loginExpiry > seconds; // last log in was recent enough
}
