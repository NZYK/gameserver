const express = require("express");
const app = express();
const port = 8080;

//静的ファイルのルーティング
app.use(express.static("./static",{fallthrough:true}));
//起動
app.listen(port, () => {
    console.log("server started on port:"+port);
});

app.get("/test",function (req,res){
    res.send("テストです")
})




//ルーティングのエラーハンドリング
app.use(function(req, res, next) {
    res.status(404).send('ERROR 404 not found');
  });