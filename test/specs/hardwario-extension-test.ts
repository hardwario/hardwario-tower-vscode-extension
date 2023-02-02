describe('HARDWARIO Code Basic Testing', () => {
  let treeViewSection: ViewSection;
  let customTreeItem;

  it('should be able to load VSCode', async () => {
    const workbench = await browser.getWorkbench();
    expect(await workbench.getTitleBar().getTitle())
      .toBe('[Extension Development Host] Visual Studio Code');
  });
  it('should show all activity bar items and HARDWARIO TOWER should be there', async () => {
    const workbench = await browser.getWorkbench();
    const viewControls = await workbench.getActivityBar().getViewControls();
    expect(await Promise.all(viewControls.map((vc) => vc.getTitle()))).toEqual([
      'Explorer',
      'Search',
      'Source Control',
      'Run and Debug',
      'Extensions',
      'HARDWARIO TOWER',
    ]);
  });
  it('can open HARDWARIO TOWER view and check that it is initialized', async () => {
    const workbench = await browser.getWorkbench();
    const extensionView = await workbench.getActivityBar().getViewControl('HARDWARIO TOWER');
    await extensionView?.openView();

    const selectedView = await workbench.getActivityBar().getSelectedViewAction();
    expect(await selectedView.getTitle()).toBe('HARDWARIO TOWER');

    const sidebar = workbench.getSideBar();
    const sections = await sidebar.getContent().getSections();
    expect(sections.length).toEqual(1);
  });
  it('HARDWARIO extension should be in basic mode', async () => {
    const workbench = await browser.getWorkbench();
    const extensionView = await workbench.getActivityBar().getViewControl('HARDWARIO TOWER');
    await extensionView?.openView();

    const selectedView = await workbench.getActivityBar().getSelectedViewAction();
    expect(await selectedView.getTitle()).toBe('HARDWARIO TOWER');

    const sidebar = workbench.getSideBar();
    treeViewSection = await sidebar.getContent().getSection('');

    // eslint-disable-next-line @typescript-eslint/await-thenable
    await expect(treeViewSection.elem).toBePresent();

    expect(await treeViewSection.getTitle()).toBe('Palette');

    expect(await treeViewSection.isExpanded()).toBe(true);
    await browser.waitUntil(async () => (await treeViewSection.getVisibleItems()).length > 0);

    const visItems = await treeViewSection.getVisibleItems();
    expect(visItems.length).toBe(11);

    expect(await Promise.all(visItems.map(
      async (item) => `${item.locatorKey} "${await (item).getLabel()}"`,
    ))).toEqual([
      'TreeItem,CustomTreeItem "TOWER: Start"',
      'TreeItem,CustomTreeItem "From Skeleton Project..."',
      'TreeItem,CustomTreeItem "From Existing Project..."',
      'TreeItem,CustomTreeItem "TOWER: Resources"',
      'TreeItem,CustomTreeItem "Product Website"',
      'TreeItem,CustomTreeItem "Technical Documentation"',
      'TreeItem,CustomTreeItem "Software Development Kit"',
      'TreeItem,CustomTreeItem "Projects on Hackster.io"',
      'TreeItem,CustomTreeItem "GitHub Repositories"',
      'TreeItem,CustomTreeItem "Discussion Forum"',
      'TreeItem,CustomTreeItem "Online shop"',
    ]);

    customTreeItem = visItems[1];
  });
});
