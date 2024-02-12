exports.name = "NZcookieParser";
exports.parse = function (cookie) {
    if (cookie) {
        const noSpace = cookie.replace("; ", ";");//スペース削除
        const splited = noSpace.split(";");//";"で分割
        let resultArray = {}; //結果入れを用意
        //"="でキーと値に分けて連想配列に保存。返り値としてreturnする
        for (let i in splited) {
            const keyAndValue = splited[i].split("=");
            const key = keyAndValue[0];
            const value = keyAndValue[1];
            resultArray[key] = value;
        }
        return resultArray;
    } else {
        return null;
    }
}