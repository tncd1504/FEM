function [tr3d,xprime,yprime]=T_transform_3node(xcoord,ycoord,zcoord,n)

%--------------------------------------------------------------
%  Purpose:
%     Compute direction cosines between three-dimensionaL
%    LocaL and gLobaL coordinate axes
%
%  Synopsis:
%     [tr3d,xprime,yprime]=fetransh(xcoord,ycoord,zcoord,n) 
%
%  VariabLe Description:
%     xcoord - nodaL x coordinates (3x1)   
%     ycoord - nodaL y coordinates (3X1)
%     zcoord - nodaL z coordinates (3X1)
%     n - number of nodes per eLement
%     tr3d - 3d transformation matrix from LocaL to gLobaL axes
%     xprime - coordinate in terms of the LocaL axes (3x1)
%     yprime - coordinate in terms of the gLobaL axes (3X1)
%
%  Note:
%     The LocaL x-axis is defined in the direction from the first node
%     to the second node. Nodes 1, 2 and 3 define the LocaL xy-pLane.
%     The LocaL z-axis is defined normaL to the LocaL xy-pLane.
%     The LocaL y-axis is defined normaL to the x and z axes.
%--------------------------------------------------------------------------
%     ^ y
%     |
%     3
%     ' \    
%     '   \     
%     '     \     
%     1-------2------> x
%-----------------------------
%  compute direction cosines
%-----------------------------
v12x=xcoord(2)-xcoord(1); 
v12y=ycoord(2)-ycoord(1);
v12z=zcoord(2)-zcoord(1);
L12=sqrt(v12x^2+v12y^2+v12z^2); % chieu dai canh 12
% vector v12 = (v12x,v12y,v12z)
v23x=xcoord(3)-xcoord(2);
v23y=ycoord(3)-ycoord(2);
v23z=zcoord(3)-zcoord(2);
L23=sqrt(v23x^2+v23y^2+v23z^2); % chieu dai canh 23
% vector v23 = (v23x,v23y,v23z))
v13x=xcoord(3)-xcoord(1); 
v13y=ycoord(3)-ycoord(1);
v13z=zcoord(3)-zcoord(1);
L13=sqrt(v13x^2+v13y^2+v13z^2); % chieu dai canh 13
% vector v13 = (v13x,v13y,v13z))
%--------------------------------------------------------------------------
% vector v12 chinh la truc x trong he toa do dia phuong
% v_x = (v12x,v12y,v12z)

%--------------------------------------------------------------------------
% vector phap tuyen v_nz cua mat phang xy tao boi hai vector_12 va vector_13
% vector_12 = [v12x,v12y,v12z]; vector_13 = [v13x,v13y,v13z];
%             __                                  __
%            | |v12y  v12z| |v12z v12x| |v12x v12y| |
% vector_n  =| |          |,|         |,|         | |
%            | |v13y  v13z| |v13z v13x| |v13x v13y| |
%             --                                  --
% vector phap tuyen v_nz cung chinh la truc z trong he toa do dia phuong
% v_nz = (v1tx,v1ty,v1tz)
%--------------------------------------------------------------------------
v1tx=v12y*v13z-v12z*v13y;
v1ty=v12z*v13x-v12x*v13z;            %  v_nz = (v1tx,v1ty,v1tz)
v1tz=v12x*v13y-v12y*v13x;
%--------------------------------------------------------------------------
% vector phap tuyen n cua mat phang xz tao boi hai v_n(vz) va vector_12
% vector_12 = [v12x,v12y,v12z]; vector_vn(vz) = [v1tx,v1ty,v1tz];
%             __                                  __
%            | |v1ty  v1tz| |v1tz v1tx| |v1tx v1ty| |
% vector_n  =| |          |,|         |,|         | |
%            | |v12y  v12z| |v12z v12x| |v12x v12y| |
%             --                                  --
% vector phap tuyen v_ny cung chinh la truc y trong he toa do dia phuong
% v_ny = (v1yx,v1yy,v1yz)
%--------------------------------------------------------------------------
v1yx=v1ty*v12z-v1tz*v12y;
v1yy=v1tz*v12x-v1tx*v12z;            % v_ny = (v1yx,v1yy,v1yz)
v1yz=v1tx*v12y-v1ty*v12x;
%-------------------------------------------------------------
% xac dinh he toa do dia phuong theo vec to phap tuyen don vi
%-------------------------------------------------------------
vxx=v12x/L12;
vxy=v12y/L12;                        % v_nx = (v12x,v12y,v12z)
vxz=v12z/L12;                        % truc x = vn_x/|vn_x|
%-------------------------------------------------------------
vyx=v1yx/sqrt(v1yx^2+v1yy^2+v1yz^2);
vyy=v1yy/sqrt(v1yx^2+v1yy^2+v1yz^2); % v_ny = (v1yx,v1yy,v1yz)
vyz=v1yz/sqrt(v1yx^2+v1yy^2+v1yz^2); % truc y = vn_y/|vn_y|
%-------------------------------------------------------------
vzx=v1tx/sqrt(v1tx^2+v1ty^2+v1tz^2);
vzy=v1ty/sqrt(v1tx^2+v1ty^2+v1tz^2); % v_nz = (v1tx,v1ty,v1tz)
vzz=v1tz/sqrt(v1tx^2+v1ty^2+v1tz^2); % truc z = vn_z/|vn_z|
%------------------------------
%    transformation matrix
%------------------------------
for i=1:2*n
i1=(i-1)*3+1;
i2=i1+1;
i3=i2+1;
tr3d(i1,i1)=vxx;
tr3d(i1,i2)=vxy;
tr3d(i1,i3)=vxz;
tr3d(i2,i1)=vyx;
tr3d(i2,i2)=vyy;
tr3d(i2,i3)=vyz;
tr3d(i3,i1)=vzx;
tr3d(i3,i2)=vzy;
tr3d(i3,i3)=vzz;
end
%----------------------------------------------
%  compute nodal values in terms of local axes
%----------------------------------------------
%     ^ y
%     |
%     3
%     ' \    
%   b '   \ a    
%     '     \     
%     1-------2------> x
%         c
%-----------------------------
% dinh ly cosin trong tam giac
% a^2 = b^2 + c^2 - 2bc*cos(213)
% 
aLpa213=acos((L12^2+L13^2-L23^2)/(2*L12*L13));
%-----------------------------------------------
xprime(1)=0;                 yprime(1)=0;
xprime(2)=L12;               yprime(2)=0;
xprime(3)=L13*cos(aLpa213);  yprime(3)=L13*sin(aLpa213);



