import os, filecmp

def compare_dirs(dir1, dir2):
    dcmp = filecmp.dircmp(dir1, dir2, ignore=['node_modules', '.git', 'dist', 'android', 'public'])
    if dcmp.diff_files:
        print(f"Diff in {dir1}:", dcmp.diff_files)
    for subdir in dcmp.common_dirs:
        compare_dirs(os.path.join(dir1, subdir), os.path.join(dir2, subdir))

compare_dirs(r'F:\Ahmed\Civil\al-bayan', r'F:\Ahmed\Civil\My CV\al-bayan')
