// VibeWatcher 测试脚本
console.log('任务开始执行...');
console.log('正在处理数据...');

setTimeout(() => {
    console.log('处理完成！');
    console.log('任务结束');
    process.exit(0);
}, 2000);
