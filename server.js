const express = require("express");
const app = express();
const port = 8080;
//セッションをインポート（サーバー側にセッションデータを持たせる）
const session = require("express-session");
const memoryStore = new session.MemoryStore;
const sess = {
    secret: "NZYKsecret",
    resave: false, //セッション内容に変更がないときにはデータをリセーブしない
    saveUninitialized: true, //初期化されていないセッションも保存するか:true
    cookie: {maxAge: 1000 * 60 * 60 * 24 * 30}, //保持期間 1000ms * 60sec * 60min * 24hours * 30 days
    store: memoryStore //セッションの保存先
};
//本番環境に移したときのみ実行する設定
if (app.get("env") === "production"){
    app.set("trust proxy", 1);//プロキシサーバーから1番目をクライアントのIPとして扱う
    sess.cookie.secure = true;//HTTPSによるアクセス時のみcookieを有効化する
}
//ほぼjinja2のテンプレートエンジンをインポート
const jinja = require("nunjucks");
jinja.configure("./static/template", {
    autoscape: true,
    express: app
});

app.set("views","./static/template")
app.set("view engine","html");
app.set("json spaces", 2);
//セッションミドルウェア
app.use(session(sess));
//アクセスログミドルウェア
app.use(function (req, res, next) {
    const reqUrl = req.protocol + "://" + req.get("host") + req.originalUrl;
    const reqDate = new Date();
    const srcIpAddr = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    console.log(`${reqDate} Access "${reqUrl}" from ${srcIpAddr}`);
    next();
});
//postデータハンドリングのためのミドルウェア
app.use(express.urlencoded({extended: true}));
//静的ファイルのルーティングを行うミドルウェア
app.use(express.static("./static", { fallthrough: true }));


//ルーティングテスト
app.get("/test", function (req, res) {
    res.send("テストです")
});

//WebAPIとuserIdをgetするテスト
app.get("/api/:userId", function (req, res) {
    res.json(
        {
            name: "Jhon Doe",
            userId: `${req.params.userId}`,
            attr: { age: 30, sex: "male" }
        });
});

//テンプレートエンジンによるカウントページのテスト
let count = 0;
app.get("/template",function (req, res){
    count++;
    res.render("sample.html",{counter:count});
});

//テンプレートの継承とpostのテスト実装
app.get("/create",function (req, res){
    res.render("create.html");
});
app.post("/create",function (req, res){
    console.log(req.body);
    res.render("create.html");
});

//セッション利用のテスト
app.get("/session", function (req, res){
    console.log(req.session);
    if (req.session.counter){
        req.session.counter++;
    }else{
        req.session.counter = 1;
    }
    res.send(`<html><body>
            <p>${req.session.counter}</p>
            <p>domain:${req.session.cookie.domain}</p>
            <p>expires:${req.session.cookie.expires}</p>
            <p>httpOnly:${req.session.cookie.httpOnly}</p>
            <p>maxAge:${req.session.cookie.maxAge}</p>
            <p>originalMaxAge:${req.session.cookie.originalMaxAge}</p>
            <p>path:${req.session.cookie.path}</p>
            <p>sameSite:${req.session.cookie.sameSite}</p>
            <p>secure:${req.session.cookie.secure}</p>
            <p>signed:${req.session.cookie.signed}</p>
    </body></html>`);
});

//ルーティングの404エラーハンドリング
app.use(function (req, res, next) {
    res.status(404).send('ERROR 404 not found');
});

//起動
app.listen(port, () => {
    console.log("server started on port:" + port);
});