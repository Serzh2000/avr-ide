// Имитатор clang-format для автотестов: читает код из stdin и печатает его в виде «табуляция → 4 пробела, пробелы в конце строк убраны».
// Запускается как Node-скрипт (AVRIDE_PRO_CLANG_FORMAT=<этот файл>); принимает те же ключи, что настоящий clang-format, и игнорирует их.
let text = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (d) => { text += d })
process.stdin.on('end', () => {
  process.stdout.write(text.split('\n').map((l) => l.replace(/\t/g, '    ').replace(/[ ]+$/, '')).join('\n'))
})
