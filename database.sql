drop database if exists `bixiv`;
create database `bixiv`;
use `bixiv`;

create table `user` (
    `username` varchar (20) not null,
    `password` varchar (100) not null
);