const express = require("express");
const app = express();
const port = 8080;
//ほぼjinja2のテンプレートエンジンをインポート
const jinja = require("nunjucks");
jinja.configure("./static/template", {
    autoscape: true,
    express: app
});

app.set("views","./static/template")
app.set("view engine","html");
app.set("json spaces", 2);

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


//ルーティングの404エラーハンドリング
app.use(function (req, res, next) {
    res.status(404).send('ERROR 404 not found');
});


//起動
app.listen(port, () => {
    console.log("server started on port:" + port);
});