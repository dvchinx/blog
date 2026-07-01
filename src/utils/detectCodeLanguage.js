export function detectCodeLanguage(code) {
  if (/^\s*(import |export |const |let |var |function |class |async function|\(|\{)/m.test(code)) {
    return 'javascript'
  }

  if (/^\s*(def |class |from |import |print\(|if __name__ == ['"]__main__['"])/m.test(code)) {
    return 'python'
  }

  if (/^\s*(public class |public static void main|System\.out\.println|package )/m.test(code)) {
    return 'java'
  }

  if (/^\s*(#include|using namespace |int main\(|cout <<)/m.test(code)) {
    return 'cpp'
  }

  if (/^\s*[-\w]+:\s*.+$/m.test(code) || /^\s*[-\w]+:\s*$/m.test(code)) {
    return 'yaml'
  }

  if (/^\s*(\$ |npm |yarn |pnpm |git |cd |ls |mkdir |curl )/m.test(code)) {
    return 'bash'
  }

  return 'text'
}
