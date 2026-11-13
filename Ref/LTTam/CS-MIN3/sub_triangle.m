function [el]=sub_triangle(xcoord,ycoord) 
%------------------------------------------------------------------
% ma tran ket noi phan tu cua ba tam giac con trong 1 phan tu chinh
%------------------------------------------------------------------
   
x_cen = sum(xcoord)/3; % toa do trong tam phuong x cua phan tu
y_cen = sum(ycoord)/3; % toa do trong tam phuong y cua phan tu
el{1} = [x_cen xcoord(1) xcoord(2); y_cen ycoord(1) ycoord(2)]; % element 1
el{2} = [x_cen xcoord(2) xcoord(3); y_cen ycoord(2) ycoord(3)]; % element 2
el{3} = [x_cen xcoord(3) xcoord(1); y_cen ycoord(3) ycoord(1)]; % element 3
