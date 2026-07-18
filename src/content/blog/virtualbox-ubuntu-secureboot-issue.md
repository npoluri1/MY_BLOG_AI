---
title: "Secureboot + Ubuntu + VirtualBox Signing kernel modules"
description: "Steps required for dealing with secureboot on Ubuntu where VirtualBox has issues"
pubDate: 2021-05-09
heroImage: "/images/linkedin/1773892471050.jpeg"
category: ["linux", "ubuntu", "virtualbox", "devops"]
author: "Naga Siva Poluri"
---

Set of steps required for dealing with secureboot on Ubuntu where VirutalBox service has issues.

### Motivation

Running `minikube start` was throwing errors about VirtualBox kernel module not loaded.

### Resolution

Had to check multiple resources to make this a working solution. Quoting all the original resources:

- [https://stegard.net/2016/10/virtualbox-secure-boot-ubuntu-fail/](https://stegard.net/2016/10/virtualbox-secure-boot-ubuntu-fail/)
- [http://askubuntu.com/questions/760671/could-not-load-vboxdrv-after-upgrade-to-ubuntu-16-04-and-i-want-to-keep-secur](http://askubuntu.com/questions/760671/could-not-load-vboxdrv-after-upgrade-to-ubuntu-16-04-and-i-want-to-keep-secur)

#### Install the virtualbox manually

```bash
sudo apt-get update
sudo apt-get install virtualbox-6.1
```

#### Sign the modules for secureboot

```bash
sudo -i
mkdir /root/module-signing
cd /root/module-signing
openssl req -new -x509 -newkey rsa:2048 -keyout MOK.priv -outform DER -out MOK.der -nodes -days 36500 -subj "/CN=Descriptive common name/"

mokutil --import /root/module-signing/MOK.der
# Input a simple password
```

#### Restart the machine

- During the boot when prompted choose `Enroll MOK`
- You will see the keys that were created and signed and choose `Continue`
- `Reboot`

#### Create a bash script to sign the kernel modules

```bash
sudo -i
touch /root/module-signing/sign-vbox-modules
vi /root/module-signing/sign-vbox-modules
```

Paste the following in to the script file (hit `i` to be in insert mode):

```bash
#!/bin/bash

for modfile in $(dirname $(modinfo -n vboxdrv))/*.ko; do
  echo "Signing $modfile"
  /usr/src/linux-headers-$(uname -r)/scripts/sign-file sha256 \
                                /root/module-signing/MOK.priv \
                                /root/module-signing/MOK.der "$modfile"
done
```

Then hit `ESC + wq` to save and quit the file.

Execute the script after updating the permissions:

```bash
chmod 700 /root/module-signing/sign-vbox-modules
/root/module-signing/sign-vbox-modules
```

Sample output should look like the following:

```bash
#  /root/module-signing/sign-vbox-modules
Signing /lib/modules/5.11.0-16-generic/updates/dkms/vboxdrv.ko
Signing /lib/modules/5.11.0-16-generic/updates/dkms/vboxnetadp.ko
Signing /lib/modules/5.11.0-16-generic/updates/dkms/vboxnetflt.ko
```

#### Start Virtualbox

```bash
modprobe vboxdrv
```

### Check

```bash
minikube start
```

should now work as expected and start the local cluster.
