// 你的任务脚本
console.log('开始执行任务...');

// 模拟一些工作
let sum = 0;
for (let i = 0; i < 1000000; i++) {
    sum += i;
}

console.log(`计算完成: ${sum}`);
console.log('任务结束');
process.exit(0);
