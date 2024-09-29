const express = require("express");
const path = require("path");
const core = require("./core");
const Database = require("./database");
const ExcelJS = require("exceljs");

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

app.get("/book", (req, res) => {
    Database.bookIsbnExists(req.query.isbn).then((exists) => {
        if (exists.status) {
            res.send(JSON.stringify({
                success: true,
                data: exists.book
            }))
        } else {
            const book = new core.Book(req.query.isbn);
            book.start().then(() => {
                res.send(JSON.stringify({
                    success: true,
                    data: book.BOOKINFO
                }))
            })
        }

    })
})

app.get("/books", async (req, res) => {
    try {
        const books = await Database.getAllBooks();

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Books');
    
        worksheet.columns = [
          { header: 'ISBN', key: '_id', width: 15 },
          { header: '标题', key: 'title', width: 30 },
          { header: '作者', key: 'author', width: 20 },
          { header: '出版社', key: 'publisher', width: 20 },
          { header: '价格', key: 'price', width: 10 },
          { header: '索书号', key: 'call', width: 15 },
          { header: '标签', key: 'tag', width: 15 }
        ];

        books.forEach(book => {
            worksheet.addRow(book);
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=books.xlsx');

        await workbook.xlsx.write(res);
        res.send();

    } catch (error) {
        console.error(error);
        res.status(500).send('导出Excel时发生错误');
    }
})

app.use(express.static(path.join(__dirname, "../docx")))

app.listen(8001, ()=>{
    console.log("expree 服务器运行在 http://0.0.0.0:8001")
})
