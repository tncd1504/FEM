function [Ds]=Ds_adjust(xcoord,ycoord,G,k,t,al_stab)

%-----------------------------------------------------------
%  Ma tran bien dang cat duoc hieu chinh (phan tu MIN3-DSG)
%-----------------------------------------------------------

L12 = sqrt((xcoord(2)-xcoord(1))^2 + (ycoord(2)-ycoord(1))^2);
L23 = sqrt((xcoord(3)-xcoord(2))^2 + (ycoord(3)-ycoord(2))^2);
L31 = sqrt((xcoord(3)-xcoord(1))^2 + (ycoord(3)-ycoord(1))^2);
he = max([L12,L23,L31]);
Ds=[G*k*t^3/(t^2+al_stab*he^2) 0; 0 G*k*t^3/(t^2+al_stab*he^2)];