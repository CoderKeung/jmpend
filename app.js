const express = require("express");
const path = require("path");
const core = require("./core");
const Database = require("./database");

const app = express()

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

app.get('/deal', (req, res) => {
    Database.articleIdExists(req.query.id).then((exists) => {
        if (exists.status) {
            res.send(JSON.stringify({
                success: true,
                id: exists.article._id,
                title: exists.article.title,
                author: exists.article.author
            }));
        } else {
            const Conversion = new core.Conversion(req.query.url)
            Conversion.start().then(() => {
                let data = {
                    success: Conversion.SUCCESS,
                    id: Conversion.ARTICLE.id,
                    title: Conversion.ARTICLE.title,
                    author: Conversion.ARTICLE.author,
                    path: `/${Conversion.ARTICLE.title}.docx`
                }
                res.send(JSON.stringify(data))
            })
        }
    })

})
app.get("/download", (req, res) => {
  let docxFile = `${__dirname}/docx/${req.query.id}.docx`
  res.download(docxFile)
})

app.use(express.static(path.join(__dirname, "../docx")))

app.listen(8001, ()=>{
    console.log("expree 服务器运行在 http://0.0.0.0:8001")
})
