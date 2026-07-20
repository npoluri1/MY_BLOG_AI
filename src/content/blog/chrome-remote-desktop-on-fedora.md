---
title: "Chrome Remote Desktop on Fedora"
description: "How to install Chrome Remote Desktop on Fedora"
pubDate: 2020-03-27
heroImage: "/images/linkedin/1762340350095.jpg"
category: ["linux", "fedora", "tutorial"]
primaryCategory: "linux"
---

How to install Chrome Remote Desktop on Fedora.

### Problem Statement

*Reference*: [Reddit thread](https://www.reddit.com/r/Fedora/comments/ah6d0w/how_do_you_install_chrome_remote_desktop_on_fedora/)

Google chrome only gives `.deb` as the installable while trying to install the browser extension. `deb` is only for Debian based systems and doesn't work on Fedora which uses `rpm` as the installables.

### Steps

#### Install perl-ExtUtils-MakeMaker-7.44-2.fc32

This is a requirement for installing [`alien`](http://joeyh.name/code/alien/) package on the fedora system.

- Download the `rpm` file from [here](https://kojipkgs.fedoraproject.org//packages/perl-ExtUtils-MakeMaker/7.44/2.fc32/noarch/perl-ExtUtils-MakeMaker-7.44-2.fc32.noarch.rpm)
- Install using `yum` by running the following command (*replace the rpm name with the version downloaded, if its different*):

```bash
sudo yum install perl-ExtUtils-MakeMaker-7.44-2.fc32.noarch.rpm -y
```

#### Install rpm build package(s)

```bash
sudo yum install rpm-build rpmrebuild -y
```

#### Install [`alien`](http://joeyh.name/code/alien/) package

*Reference*: [how-to-install-deb-packages-on-fedora/](https://www.systutorials.com/how-to-install-deb-packages-on-fedora/)

- Download the `tar.gz` from [here](http://ftp.de.debian.org/debian/pool/main/a/alien/alien_8.92.tar.gz)
- Run the following commands (*assumption is that `perl` is already installed*) and `alien` will be installed:

```bash
tar xf alien-VERSION.tar.gz
cd alien
perl Makefile.PL; make; sudo make install
```

#### Download google chrome browser extension

- Install Google chrome Remote Desktop extension from [here](https://chrome.google.com/webstore/detail/chrome-remote-desktop/gbchcmhmhahfdphkhkmpfmihenigjmpp)
- Download the `deb` installable by clicking on the Remote Desktop Chrome Extension

#### Convert `deb` to `rpm`

- Run `alien` command to convert the `deb` to `rpm` (*this uses `rpmbuild` command internally*):

```bash
sudo alien -r chrome-remote-desktop_current_amd64.deb
```

**Succesful Run will look like the following:**

```bash
$ sudo alien -r chrome-remote-desktop_current_amd64.deb
Warning: Skipping conversion of scripts in package chrome-remote-desktop: postinst postrm preinst prerm
Warning: Use the --scripts parameter to include the scripts.
chrome-remote-desktop-81.0.4044.60-2.x86_64.rpm generated
```

#### Edit the `rpm` file to remove the conflicting dirs

- Run the following command on the `rpm`, opens up the editor:

```bash
rpmrebuild -e -p chrome-remote-desktop-81.0.4044.60-2.x86_64.rpm
```

- Remove the following lines and save the file:

```
%dir %attr(0755, root, root) "/"
%dir %attr(0755, root, root) "/etc/init.d"
%dir %attr(0755, root, root) "/usr/lib"
```

- In the terminal when it prompts, hit `Y`
- The result is usually written out to a location like the following:

```
result: /home/<username>/rpmbuild/RPMS/x86_64/chrome-remote-desktop-81.0.4044.60-2.x86_64.rpm
```

#### Finally install the `rpm`

```bash
$ sudo yum install /home/narenandu/rpmbuild/RPMS/x86_64/chrome-remote-desktop-81.0.4044.60-2.x86_64.rpm
...
Complete!
```
