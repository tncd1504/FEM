function [bmat_b,bmat_s,area] = B_mat_Plate_Q4_Iso_v1_2(xgs,ygs,x,y)

%% B_Mat Computes the strain-displacement matrix for bending moments
%        and shear forces
%
%  Parameters:
%
%    Input, xgs : Local X coordinate of the Gauss point
%           ygs : Local Y coordinate of the Gauss point
%           x   : X Coordinates of the element
%           y   : Y Coordinates of the element
%   
%    Output, bmat_b the strain-displacement matrix for bending moments
%            bmat_s the strain-displacement matrix for shear forces
%              area the element area

%==================

  N(1) = (1-xgs)*(1-ygs)/4 ;
  N(2) = (1+xgs)*(1-ygs)/4 ;
  N(3) = (1+xgs)*(1+ygs)/4 ;
  N(4) = (1-xgs)*(1+ygs)/4 ;
  
  dxNl(1) = (-1+ygs)/4;
  dxNl(2) = ( 1-ygs)/4;
  dxNl(3) = ( 1+ygs)/4;
  dxNl(4) = (-1-ygs)/4;

  dyNl(1) = (-1+xgs)/4;
  dyNl(2) = (-1-xgs)/4;
  dyNl(3) = ( 1+xgs)/4;
  dyNl(4) = ( 1-xgs)/4;

  xjacm(1,1) = x(1)*dxNl(1) + x(2)*dxNl(2) + x(3)*dxNl(3) + x(4)*dxNl(4);
  xjacm(1,2) = y(1)*dxNl(1) + y(2)*dxNl(2) + y(3)*dxNl(3) + y(4)*dxNl(4);
  xjacm(2,1) = x(1)*dyNl(1) + x(2)*dyNl(2) + x(3)*dyNl(3) + x(4)*dyNl(4);
  xjacm(2,2) = y(1)*dyNl(1) + y(2)*dyNl(2) + y(3)*dyNl(3) + y(4)*dyNl(4);
  
  xjaci = inv(xjacm);
      
  area2 = abs(xjacm(1,1)*xjacm(2,2) - xjacm(2,1)*xjacm(1,2));
  area  = area2/2;
  
  dxN(1) = xjaci(1,1)*dxNl(1)+xjaci(1,2)*dyNl(1);
  dxN(2) = xjaci(1,1)*dxNl(2)+xjaci(1,2)*dyNl(2);
  dxN(3) = xjaci(1,1)*dxNl(3)+xjaci(1,2)*dyNl(3);
  dxN(4) = xjaci(1,1)*dxNl(4)+xjaci(1,2)*dyNl(4);
 
  dyN(1) = xjaci(2,1)*dxNl(1)+xjaci(2,2)*dyNl(1);
  dyN(2) = xjaci(2,1)*dxNl(2)+xjaci(2,2)*dyNl(2);
  dyN(3) = xjaci(2,1)*dxNl(3)+xjaci(2,2)*dyNl(3);
  dyN(4) = xjaci(2,1)*dxNl(4)+xjaci(2,2)*dyNl(4);

%==================

      bmat_b1  = [ 0,-dxN(1),     0  ;
                   0,      0,-dyN(1) ;
                   0,-dyN(1),-dxN(1)];
               
      bmat_b2  = [ 0,-dxN(2),     0  ;
                   0,      0,-dyN(2) ;
                   0,-dyN(2),-dxN(2)];
               
      bmat_b3  = [ 0,-dxN(3),     0  ;
                   0,      0,-dyN(3) ;
                   0,-dyN(3),-dxN(3)];
               
      bmat_b4  = [ 0,-dxN(4),     0  ;
                   0,      0,-dyN(4) ;
                   0,-dyN(4),-dxN(4)];

      bmat_b = [bmat_b1,bmat_b2,bmat_b3,bmat_b4];
      
%==================

      bmat_s1  = [ dxN(1), -N(1),    0  ;
                   dyN(1),     0, -N(1)];
               
      bmat_s2  = [ dxN(2), -N(2),    0  ;
                   dyN(2),     0, -N(2)];
               
      bmat_s3  = [ dxN(3), -N(3),    0  ;
                   dyN(3),     0, -N(3)];
               
      bmat_s4  = [ dxN(4), -N(4),    0  ;
                   dyN(4),     0, -N(4)];
 
      bmat_s = [bmat_s1,bmat_s2,bmat_s3,bmat_s4];
      
