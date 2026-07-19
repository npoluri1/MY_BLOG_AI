---
title: "SLURM on WSL"
description: "Setting up SLURM on WSL"
pubDate: 2024-05-27
heroImage: "/images/linkedin/1772028894100.jpg"
category: ["hpc", "wsl", "linux", "slurm"]
author: "Naga Siva Poluri"
primaryCategory: "hpc"
---

Setting up SLURM on WSL.

## Recommended Background Reading

Before diving into this guide, it is recommended to read the previous post:

- [Introduction to SLURM](/blog/slurm-intro/) — A beginner's guide to understanding SLURM, resource allocation, and basic workload scheduling.

## SLURM installation on WSL

### Installing Munge

```bash
sudo apt install libgcrypt20-dev
tar -xf munge-0.5.16.tar.xz
cd munge-0.5.16/
./configure \
     --prefix=/usr \
     --sysconfdir=/etc \
     --localstatedir=/var \
     --runstatedir=/run
make
make check
sudo make install
which munge
```

### Installing MySQL

```bash
sudo apt-get install mysql-server
```

```bash
sudo apt-get install build-essential fakeroot devscripts
sudo apt-get install equivs
wget https://download.schedmd.com/slurm/slurm-24.05.0-0rc1.tar.bz2
tar -xf slurm-24.05.0-0rc1.tar.bz2
cd slurm-24.05.0-0rc1/
sudo mk-build-deps -i debian/control
./configure
sudo make install
ls /usr/local/lib/libslurm.so
ldconfig -n /usr/local/lib
```

```bash
sudo apt install munge slurm-wlm net-tools slurm-wlm-doc
hostname
slurmd -C
ifconfig  # Find eth0 IP address
sudo mkdir /etc/slurm-llnl
sudo vi /etc/slurm-llnl/slurm.conf
sudo systemctl enable slurmctld
sudo service slurmctld start
sudo systemctl enable slurmd
sudo service slurmd start
```

### Start munge

```bash
sudo /etc/init.d/munge start
Starting munge (via systemctl): munge.service.
```

### Check munge status

```bash
$ sudo /etc/init.d/munge status
● munge.service - MUNGE authentication service
     Loaded: loaded (/lib/systemd/system/munge.service; enabled; vendor preset: enabled)
     Active: active (running) since Mon 2024-05-20 18:00:25 PDT; 19min ago
       Docs: man:munged(8)
   Main PID: 5825 (munged)
      Tasks: 4 (limit: 38448)
     Memory: 624.0K
     CGroup: /system.slice/munge.service
             └─5825 /usr/sbin/munged

May 20 18:00:25 skynetPC systemd[1]: Starting MUNGE authentication service...
May 20 18:00:25 skynetPC systemd[1]: Started MUNGE authentication service.
```
