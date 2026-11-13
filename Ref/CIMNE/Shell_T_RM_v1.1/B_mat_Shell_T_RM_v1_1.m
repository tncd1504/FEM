function [bmat_b,bmat_s,bmat_m,area] = B_mat_Shell_T_RM_v1_1(x,y,xgs,ygs,Te)

%% B_Mat Computes the strain-displacement matrix for bending moments,
%        membrane forces and shear forces
%
%  Parameters:
%
%    Input, x   : X Coordinates of the element
%           y   : Y Coordinates of the element
%           xgs : Local X coordinate of the Gauss point
%           ygs : Local Y coordinate of the Gauss point
%           Te  : Rotation matrix
%   
%    Output, bmat_b the strain-displacement matrix for bending moments
%            bmat_m the strain-displacement matrix for membrane forces
%            bmat_s the strain-displacement matrix for shear forces
%              area the element area

%==================

  N(1) = 1.0 - xgs - ygs ;
  N(2) = xgs ;
  N(3) = ygs ;
  
  dxNloc(1) = -1.0;
  dxNloc(2) =  1.0;
  dxNloc(3) =  0.0;

  dyNloc(1) = -1.0;
  dyNloc(2) =  0.0;
  dyNloc(3) =  1.0;

  xjacm(1,1) = x(1)*dxNloc(1) + x(2)*dxNloc(2) + x(3)*dxNloc(3);
  xjacm(1,2) = y(1)*dxNloc(1) + y(2)*dxNloc(2) + y(3)*dxNloc(3);
  xjacm(2,1) = x(1)*dyNloc(1) + x(2)*dyNloc(2) + x(3)*dyNloc(3);
  xjacm(2,2) = y(1)*dyNloc(1) + y(2)*dyNloc(2) + y(3)*dyNloc(3);
  
  xjaci = inv(xjacm);

  area2 = abs(xjacm(1,1)*xjacm(2,2) - xjacm(2,1)*xjacm(1,2));
  area  = area2/2;
  
  dxN(1) = xjaci(1,1)*dxNloc(1)+xjaci(1,2)*dyNloc(1);
  dxN(2) = xjaci(1,1)*dxNloc(2)+xjaci(1,2)*dyNloc(2);
  dxN(3) = xjaci(1,1)*dxNloc(3)+xjaci(1,2)*dyNloc(3);
 
  dyN(1) = xjaci(2,1)*dxNloc(1)+xjaci(2,2)*dyNloc(1);
  dyN(2) = xjaci(2,1)*dxNloc(2)+xjaci(2,2)*dyNloc(2);
  dyN(3) = xjaci(2,1)*dxNloc(3)+xjaci(2,2)*dyNloc(3);

%==================

      bmat_b1  = [ 0, 0, 0,-dxN(1),     0  ;
                   0, 0, 0,      0,-dyN(1) ;
                   0, 0, 0,-dyN(1),-dxN(1)];
               
      bmat_b2  = [ 0, 0, 0,-dxN(2),     0  ;
                   0, 0, 0,      0,-dyN(2) ;
                   0, 0, 0,-dyN(2),-dxN(2)];
               
      bmat_b3  = [ 0, 0, 0,-dxN(3),     0  ;
                   0, 0, 0,      0,-dyN(3) ;
                   0, 0, 0,-dyN(3),-dxN(3)];
 
      bmat_b = [bmat_b1,bmat_b2,bmat_b3];
      
%==================

      bmat_s1d  = [ 0, 0, dxN(1) ;
                    0, 0, dyN(1)];
               
      bmat_s2d  = [ 0, 0, dxN(2) ;
                    0, 0, dyN(2)];
               
      bmat_s3d  = [ 0, 0, dxN(3) ;
                    0, 0, dyN(3)];

      bmat_s1r  = [ -N(1),    0  ;
                        0, -N(1)];
               
      bmat_s2r  = [ -N(2),    0  ;
                        0, -N(2)];

      bmat_s3r  = [ -N(3),    0  ;
                        0, -N(3)];

      bmat_s1 = [bmat_s1d*Te,bmat_s1r];
      bmat_s2 = [bmat_s2d*Te,bmat_s2r];
      bmat_s3 = [bmat_s3d*Te,bmat_s3r];

      bmat_s = [bmat_s1,bmat_s2,bmat_s3];
      
%==================

      bmat_m1d  = [ dxN(1),     0,  0 ;
                         0, dyN(1), 0 ;
                    dyN(1), dxN(1), 0];
               
      bmat_m2d  = [ dxN(2),      0, 0 ;
                         0, dyN(2), 0 ;
                    dyN(2), dxN(2), 0];
               
      bmat_m3d  = [ dxN(3),      0, 0 ;
                        0, dyN(3),  0 ;
                   dyN(3), dxN(3),  0];
               
       bmat_mir  = [ 0, 0 ;
                     0, 0 ;
                     0, 0];
                 
      bmat_m1 = [bmat_m1d*Te,bmat_mir];
      bmat_m2 = [bmat_m2d*Te,bmat_mir];
      bmat_m3 = [bmat_m3d*Te,bmat_mir];

      bmat_m = [bmat_m1,bmat_m2,bmat_m3];

