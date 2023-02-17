const fs = require("fs");
const readline = require("readline");
const child = require("child_process");

const safely = async (fn) => await new Promise((res) => fn(res));
const extractPdfs = (files) => files.filter((file) => file.includes(".PDF")); // 대문자 .PDF만 뽑아옵니다.
const extractDirs = (files) =>
  files.filter((file) => file.isDirectory()).map((file) => file.name);

const removeFormat = (str, ...formats) => {
  formats.map((format) =>
    str.includes(`.${format}`)
      ? (str = str.slice(0, str.lastIndexOf() - 3))
      : str
  );
  return str;
};
const readLine = (cb) => {
  const rl = readline.Interface({
    input: process.stdin,
    output: process.stdout,
  });
  console.log("Enter a directory path : ");
  rl.on("line", (dir) => {
    cb(dir);
    rl.close();
  });
};

const init = async () => {
  const start = new Date();
  const dir = await safely((res) => readLine((dir) => res(dir)));
  let mfrs = await safely((res) =>
    fs.readdir(dir, { withFileTypes: true }, (err, files) =>
      err ? res([]) : res(extractDirs(files))
    )
  );
  fs.writeFileSync("./metatag_error_log.json", "{}");

  // * 모든 폴더 반복
  for (let mfr of mfrs) {
    console.log(`\n${dir}/${mfr} start\n`);
    const filesArray = [];
    const pdfs = await safely((res) =>
      fs.readdir(`${dir}/${mfr}`, (err, files) =>
        err ? res([]) : res(extractPdfs(files))
      )
    );
    // * 폴더 안 .PDF 포멧을 가진 pdf파일 반복
    for (let i = 0, len = pdfs.length; i < len; i++) {
      // dev path ${__dirname}/assets/exiftool.exe
      // console.log(`${__dirname}/assets/exiftool.exe ${dir}/${mfr}/${pdfs[i]} -overwrite_original -title="${removeFormat(pdfs[i], 'pdf', 'PDF')} ${mfr} | Alldatasheet" -keywords="${mfr} ${removeFormat(
      //   pdfs[i],
      //   'pdf',
      //   'PDF'
      // )} free download"
      //   `)
      // * exiftool실행
      const process = child.exec(
        `exiftool ${dir}/${mfr}/${
          pdfs[i]
        } -overwrite_original -title="${removeFormat(
          pdfs[i],
          "pdf",
          "PDF"
        )} ${mfr} | Alldatasheet"`
      );
      // * 5개 마다 한 번씩 await
      if (i % 5 === 0) {
        const res = await new Promise((res) => {
          process.on("close", (code) => {
            if (code) filesArray.push(pdfs[i]);
            res(`${pdfs[i]}, ${code}`);
          });
        });
        console.log(res);
      } else {
        process.on("close", (code, signal) => {
          if (code) filesArray.push(pdfs[i]);
          console.log(`${pdfs[i]}, ${code}`);
        });
      }
    }
    // * 아직 처리하지 못한 exiftool 결과를 2초동안 기다림
    await new Promise((r) => setTimeout(r, 3000));
    // * 에러파일 저장
    const filesObject = JSON.parse(
      fs.readFileSync("./metatag_error_log.json", "utf-8")
    );
    if (filesArray.length) filesObject[mfr] = filesArray;
    fs.writeFileSync("./metatag_error_log.json", JSON.stringify(filesObject));
    console.log(`\n${dir}/${mfr} done\n`);
    console.log(`지금까지 걸린 시간 : `, new Date() - start, "ms");
  }
  console.log("총 걸린 시간 : ", new Date() - start, "ms");
};
init();
