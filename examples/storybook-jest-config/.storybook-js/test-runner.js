const label = 'config-loaded';
const config = {
  async preVisit(page) {
    await page.evaluate((value) => { document.body.dataset.runner = value; }, label);
  },
  async postVisit(page, context) {
    const value = await page.evaluate(() => document.body.dataset.runner);
    if (value !== label) throw new Error('JavaScript runner hooks were not applied');
    await page.getByRole('button', { name: /^Count [12]$/ }).waitFor();
    console.log(`CONFIG_POST_VISIT:${context.id}:${value}`);
  },
};
export default config;
