function [a1,a2,a3,b1,b2,b3,length_side]=cal_side(x,y)
%-----------------------------------------------------------
% Purpose:
%  tinh ma cac thong so hinh hoc va canh co do dai lon nhat
%
% Synopsis:
% [a1,a2,a3,b1,b2,b3,length_side]=cal_side(x,y)
%
% Variable description:
% x - toa do cua phan tu theo phuong x
% y - toa do cua phan tu theo phuong y
% a1,a2,a3,b1,b2,b3 - la cac thong so hnh hoc cua phan tu
%------------------------------------------------------------
%   Coded by Ho Huu Vinh
%   FOSAT Group – HCMC, Vietnam
%   Email: hohuuvinh90@gmail.com or hohuuvingspkt@gmail.com
%   Last modified: February 2013
%-------------------------------------------------------------
a1 = x(3)-x(2);
a2 = x(1)-x(3);
a3 = x(2)-x(1);
b1 = y(2)-y(3);
b2 = y(3)-y(1);
b3 = y(1)-y(2);
L12 = sqrt((x(2)-x(1))^2 + (y(2)-y(1))^2);
L23 = sqrt((x(3)-x(2))^2 + (y(3)-y(2))^2);
L31 = sqrt((x(3)-x(1))^2 + (y(3)-y(1))^2);
length_side = max([L12,L23,L31]);